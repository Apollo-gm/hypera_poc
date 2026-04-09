const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {
  const { Users, Shipments, ConferenceAttempts, ShipmentHistory } =
    cds.entities("hypera.conferencia");

  const now = () => new Date().toISOString();

  async function getUser(userId, req) {
    const user = await SELECT.one.from(Users).where({ ID: userId });

    if (!user) {
      req.error(404, "Usuário não encontrado.");
      return null;
    }

    return user;
  }

  async function getShipment(shipmentId, req) {
    const shipment = await SELECT.one.from(Shipments).where({ ID: shipmentId });

    if (!shipment) {
      req.error(404, "Remessa não encontrada.");
      return null;
    }

    return shipment;
  }

  async function getSupervisor(supervisorId, req) {
    const supervisor = await getUser(supervisorId, req);

    if (!supervisor) {
      return null;
    }

    if (supervisor.role !== "SUPERVISOR") {
      req.error(403, "Somente supervisor pode executar esta ação.");
      return null;
    }

    return supervisor;
  }

  async function insertHistory({
    shipmentId,
    attemptNumber,
    countedQuantity,
    result,
    divergenceReason,
    userName,
  }) {
    await INSERT.into(ShipmentHistory).entries({
      shipment_ID: shipmentId,
      attemptNumber,
      countedQuantity,
      result,
      divergenceReason,
      userName,
      performedAt: now(),
    });
  }

  this.on("startConference", async (req) => {
    const { shipmentId, userId } = req.data;

    const shipment = await getShipment(shipmentId, req);
    if (!shipment) return;

    const user = await getUser(userId, req);
    if (!user) return;

    await UPDATE(Shipments)
      .set({
        status: "IN_PROGRESS",
        operator: user.name,
        lastUpdate: now(),
      })
      .where({ ID: shipmentId });

    return "Conferência iniciada com sucesso.";
  });

  this.on("submitCount", async (req) => {
    const { shipmentId, userId, countedQuantity, divergenceReason } = req.data;

    const shipment = await getShipment(shipmentId, req);
    if (!shipment) return;

    const user = await getUser(userId, req);
    if (!user) return;

    const lastAttempt = await SELECT.one
      .from(ConferenceAttempts)
      .where({ shipment_ID: shipmentId })
      .orderBy("attemptNumber desc");

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    let attemptStatus = "OPEN";
    let shipmentStatus = "IN_PROGRESS";
    let message = "";

    if (countedQuantity === shipment.expectedQuantity) {
      attemptStatus = "APPROVED";
      shipmentStatus = "APPROVED";
      message = "Contagem validada com sucesso.";
    } else if (attemptNumber === 1) {
      attemptStatus = "DIVERGENT";
      shipmentStatus = "DIVERGENT";
      message = "Divergência identificada. Nova tentativa necessária.";
    } else if (attemptNumber === 2) {
      attemptStatus = "AWAITING_SUP";
      shipmentStatus = "AWAITING_SUP";
      message =
        "Divergência persistente. Aguardando supervisor para liberar a 3ª contagem.";
    } else {
      attemptStatus = "BOX_BY_BOX";
      shipmentStatus = "BOX_BY_BOX";
      message =
        "Divergência persistente. Seguir para conferência caixa por caixa.";
    }

    const insertResult = await INSERT.into(ConferenceAttempts).entries({
      shipment_ID: shipmentId,
      attemptNumber,
      countedQuantity,
      status: attemptStatus,
      divergenceReason,
      countedBy_ID: userId,
    });

    const attemptId =
      Array.isArray(insertResult) && insertResult[0] && insertResult[0].ID
        ? insertResult[0].ID
        : insertResult && insertResult.ID
          ? insertResult.ID
          : null;

    await UPDATE(Shipments)
      .set({
        countedQuantity,
        status: shipmentStatus,
        attempts: attemptNumber,
        operator: user.name,
        lastUpdate: now(),
      })
      .where({ ID: shipmentId });

    await insertHistory({
      shipmentId,
      attemptNumber,
      countedQuantity,
      result: attemptStatus,
      divergenceReason,
      userName: user.name,
    });

    if (attemptId && attemptStatus === "APPROVED") {
      await UPDATE(ConferenceAttempts)
        .set({ approvedBy_ID: userId })
        .where({ ID: attemptId });
    }

    return message;
  });

  this.on("approveAttempt", async (req) => {
    const { attemptId, supervisorId } = req.data;

    const attempt = await SELECT.one
      .from(ConferenceAttempts)
      .where({ ID: attemptId });
    if (!attempt) {
      return req.error(404, "Tentativa não encontrada.");
    }

    const supervisor = await getSupervisor(supervisorId, req);
    if (!supervisor) return;

    await UPDATE(ConferenceAttempts)
      .set({
        status: "APPROVED",
        approvedBy_ID: supervisorId,
      })
      .where({ ID: attemptId });

    await UPDATE(Shipments)
      .set({
        status: "APPROVED",
        countedQuantity: attempt.countedQuantity,
        operator: supervisor.name,
        lastUpdate: now(),
      })
      .where({ ID: attempt.shipment_ID });

    await insertHistory({
      shipmentId: attempt.shipment_ID,
      attemptNumber: attempt.attemptNumber,
      countedQuantity: attempt.countedQuantity,
      result: "APPROVED",
      divergenceReason: attempt.divergenceReason,
      userName: supervisor.name,
    });

    return "Apontamento aprovado pelo supervisor.";
  });

  this.on("releaseThirdCount", async (req) => {
    const { shipmentId, supervisorId } = req.data;

    const shipment = await getShipment(shipmentId, req);
    if (!shipment) return;

    const supervisor = await getSupervisor(supervisorId, req);
    if (!supervisor) return;

    if (shipment.status !== "AWAITING_SUP") {
      return req.error(
        400,
        "A remessa precisa estar aguardando supervisor para liberar a 3ª contagem.",
      );
    }

    await UPDATE(Shipments)
      .set({
        status: "IN_PROGRESS",
        operator: supervisor.name,
        lastUpdate: now(),
      })
      .where({ ID: shipmentId });

    return "3ª contagem liberada com sucesso.";
  });

  this.on("startBoxByBox", async (req) => {
    const { shipmentId, supervisorId } = req.data;

    const shipment = await getShipment(shipmentId, req);
    if (!shipment) return;

    const supervisor = await getSupervisor(supervisorId, req);
    if (!supervisor) return;

    await UPDATE(Shipments)
      .set({
        status: "BOX_BY_BOX",
        operator: supervisor.name,
        lastUpdate: now(),
      })
      .where({ ID: shipmentId });

    return "Fluxo caixa por caixa iniciado.";
  });
});
