const cds = require("@sap/cds");

module.exports = cds.service.impl(function () {
  const { Users, Shipments, ConferenceAttempts } = this.entities;

  const requireId = (req, value, label) => {
    if (!value) {
      req.reject(400, `${label} é obrigatório.`);
    }
  };

  const requireNonNegativeInteger = (req, value, label) => {
    if (!Number.isInteger(value) || value < 0) {
      req.reject(400, `${label} deve ser um inteiro maior ou igual a zero.`);
    }
  };

  const getShipment = async (req, shipmentId) => {
    const shipment = await SELECT.one.from(Shipments).where({ ID: shipmentId });

    if (!shipment) {
      req.reject(404, "Remessa não encontrada.");
    }

    return shipment;
  };

  const getUser = async (req, userId, { mustBeSupervisor = false } = {}) => {
    const user = await SELECT.one.from(Users).where({ ID: userId });

    if (!user) {
      req.reject(404, "Usuário não encontrado.");
    }

    if (mustBeSupervisor && user.role !== "SUPERVISOR") {
      req.reject(403, "Somente supervisor pode executar esta ação.");
    }

    return user;
  };

  const getAttempt = async (req, attemptId) => {
    const attempt = await SELECT.one
      .from(ConferenceAttempts)
      .where({ ID: attemptId });

    if (!attempt) {
      req.reject(404, "Tentativa não encontrada.");
    }

    return attempt;
  };

  this.on("startConference", async (req) => {
    const { shipmentId, userId } = req.data;

    requireId(req, shipmentId, "shipmentId");
    requireId(req, userId, "userId");

    await getUser(req, userId);
    const shipment = await getShipment(req, shipmentId);

    if (shipment.status === "APPROVED") {
      req.reject(409, "A remessa já foi aprovada.");
    }

    await UPDATE(Shipments)
      .set({ status: "IN_PROGRESS" })
      .where({ ID: shipmentId });

    return "Conferência iniciada com sucesso.";
  });

  this.on("submitCount", async (req) => {
    const { shipmentId, userId, countedQuantity, divergenceReason } = req.data;

    requireId(req, shipmentId, "shipmentId");
    requireId(req, userId, "userId");
    requireNonNegativeInteger(req, countedQuantity, "countedQuantity");

    await getUser(req, userId);
    const shipment = await getShipment(req, shipmentId);

    if (shipment.status === "APPROVED") {
      req.reject(409, "A remessa já foi aprovada.");
    }

    const lastAttempt = await SELECT.one
      .from(ConferenceAttempts)
      .where({ shipment_ID: shipmentId })
      .orderBy("attemptNumber desc");

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    let attemptStatus;
    let shipmentStatus;
    let message;

    if (countedQuantity === shipment.expectedQuantity) {
      attemptStatus = "APPROVED";
      shipmentStatus = "APPROVED";
      message = "Contagem validada com sucesso.";
    } else if (attemptNumber >= 2) {
      attemptStatus = "BOX_BY_BOX";
      shipmentStatus = "BOX_BY_BOX";
      message =
        "Divergência persistente. Seguir para conferência caixa por caixa.";
    } else {
      attemptStatus = "DIVERGENT";
      shipmentStatus = "AWAITING_SUP";
      message = "Divergência identificada. Aguardando decisão do supervisor.";
    }

    await INSERT.into(ConferenceAttempts).entries({
      shipment_ID: shipmentId,
      attemptNumber,
      countedQuantity,
      status: attemptStatus,
      divergenceReason: divergenceReason || null,
      countedBy_ID: userId,
    });

    await UPDATE(Shipments)
      .set({
        countedQuantity,
        status: shipmentStatus,
      })
      .where({ ID: shipmentId });

    return message;
  });

  this.on("approveAttempt", async (req) => {
    const { attemptId, supervisorId } = req.data;

    requireId(req, attemptId, "attemptId");
    requireId(req, supervisorId, "supervisorId");

    const attempt = await getAttempt(req, attemptId);
    await getUser(req, supervisorId, { mustBeSupervisor: true });

    if (attempt.status === "APPROVED") {
      req.reject(409, "A tentativa já foi aprovada.");
    }

    await UPDATE(ConferenceAttempts)
      .set({
        status: "APPROVED",
        approvedBy_ID: supervisorId,
      })
      .where({ ID: attemptId });

    await UPDATE(Shipments)
      .set({
        countedQuantity: attempt.countedQuantity,
        status: "APPROVED",
      })
      .where({ ID: attempt.shipment_ID });

    return "Apontamento aprovado pelo supervisor.";
  });

  this.on("startBoxByBox", async (req) => {
    const { shipmentId, supervisorId } = req.data;

    requireId(req, shipmentId, "shipmentId");
    requireId(req, supervisorId, "supervisorId");

    const shipment = await getShipment(req, shipmentId);
    await getUser(req, supervisorId, { mustBeSupervisor: true });

    if (shipment.status === "APPROVED") {
      req.reject(
        409,
        "Não é possível iniciar caixa por caixa para uma remessa aprovada.",
      );
    }

    const lastAttempt = await SELECT.one
      .from(ConferenceAttempts)
      .where({ shipment_ID: shipmentId })
      .orderBy("attemptNumber desc");

    if (lastAttempt && lastAttempt.status !== "APPROVED") {
      await UPDATE(ConferenceAttempts)
        .set({ status: "BOX_BY_BOX" })
        .where({ ID: lastAttempt.ID });
    }

    await UPDATE(Shipments)
      .set({ status: "BOX_BY_BOX" })
      .where({ ID: shipmentId });

    return "Fluxo caixa por caixa iniciado.";
  });
});
