const cds = require("@sap/cds");

const buildUiShipment = (shipment, attemptsByShipment, palletsByShipment) => {
  const pallets = palletsByShipment.get(shipment.ID) || [];
  const attempts = attemptsByShipment.get(shipment.ID) || 0;

  return {
    ID: shipment.ID,
    transportDocument: shipment.transportDocument,
    shipmentNumber: shipment.shipmentNumber,
    orderNumber: shipment.orderNumber,
    product: shipment.product,
    carrier: shipment.carrier,
    carrierPlate: shipment.carrierPlate,
    dock: shipment.dock,
    destination: shipment.destination,
    expectedQuantity: shipment.expectedQuantity,
    countedQuantity: shipment.countedQuantity,
    status: shipment.status,
    palletTag: shipment.palletTag,
    notes: shipment.notes,
    attempts,
    pallets: pallets.map((pallet) => ({
      ID: pallet.ID,
      boxIdentifier: pallet.boxIdentifier,
      tag: pallet.tag,
      barcode: pallet.barcode,
      lot: pallet.lot,
      checked: !!pallet.checked,
      scanned: !!pallet.scanned,
    })),
  };
};

const normalizeUiPayload = (shipments, attempts, pallets) => {
  const attemptsByShipment = new Map();
  const palletsByShipment = new Map();

  for (const attempt of attempts) {
    const shipmentId = attempt.shipment_ID;
    const current = attemptsByShipment.get(shipmentId) || 0;
    attemptsByShipment.set(shipmentId, current + 1);
  }

  for (const pallet of pallets) {
    const shipmentId = pallet.shipment_ID;
    if (!palletsByShipment.has(shipmentId)) {
      palletsByShipment.set(shipmentId, []);
    }
    palletsByShipment.get(shipmentId).push(pallet);
  }

  return {
    Shipments: shipments.map((shipment) =>
      buildUiShipment(shipment, attemptsByShipment, palletsByShipment),
    ),
  };
};

cds.on("bootstrap", (app) => {
  app.get("/ui/mockdata", async (_req, res) => {
    try {
      const db = await cds.connect.to("db");
      const { Shipments, ConferenceAttempts, VolumeChecks } =
        db.entities("hypera.conferencia");

      const shipments = await db.run(
        SELECT.from(Shipments).orderBy("shipmentNumber"),
      );

      const attempts = await db.run(SELECT.from(ConferenceAttempts));
      const pallets = await db.run(SELECT.from(VolumeChecks).orderBy("tag"));

      res.json(normalizeUiPayload(shipments, attempts, pallets));
    } catch (error) {
      res.status(500).json({
        error: "Falha ao montar payload compatível com o front.",
        details: error.message,
      });
    }
  });
});

module.exports = cds.service.impl(function () {
  const { Users, Shipments, ConferenceAttempts, VolumeChecks } = this.entities;

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

  const getLastAttempt = async (shipmentId) => {
    return SELECT.one
      .from(ConferenceAttempts)
      .where({ shipment_ID: shipmentId })
      .orderBy("attemptNumber desc");
  };

  this.on("READ", "Shipments", async (req, next) => {
    const result = await next();

    if (!result) {
      return result;
    }

    const rows = Array.isArray(result) ? result : [result];
    if (!rows.length) {
      return result;
    }

    const shipmentIds = rows.map((row) => row.ID);

    const attempts = await SELECT.from(ConferenceAttempts).where({
      shipment_ID: { in: shipmentIds },
    });

    const pallets = await SELECT.from(VolumeChecks).where({
      shipment_ID: { in: shipmentIds },
    });

    const payload = normalizeUiPayload(rows, attempts, pallets).Shipments;

    return Array.isArray(result) ? payload : payload[0];
  });

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

    await UPDATE(VolumeChecks)
      .set({ scanned: false })
      .where({ shipment_ID: shipmentId });

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

    const lastAttempt = await getLastAttempt(shipmentId);
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    let attemptStatus = "OPEN";
    let shipmentStatus = "IN_PROGRESS";
    let message = "";

    if (countedQuantity === shipment.expectedQuantity) {
      attemptStatus = "APPROVED";
      shipmentStatus = "APPROVED";
      message = "Quantidade conferida bate com a esperada. Remessa aprovada.";
    } else if (attemptNumber >= 3) {
      attemptStatus = "BOX_BY_BOX";
      shipmentStatus = "BOX_BY_BOX";
      message =
        "Divergência persistente após 3 tentativas. Iniciando conferência caixa por caixa.";
    } else if (attemptNumber === 2) {
      attemptStatus = "DIVERGENT";
      shipmentStatus = "AWAITING_SUP";
      message =
        "2ª divergência identificada. É necessário aguardar liberação do supervisor.";
    } else {
      attemptStatus = "DIVERGENT";
      shipmentStatus = "DIVERGENT";
      message = "Divergência identificada. Realize uma nova contagem.";
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

  this.on("releaseThirdCount", async (req) => {
    const { shipmentId, supervisorId } = req.data;

    requireId(req, shipmentId, "shipmentId");
    requireId(req, supervisorId, "supervisorId");

    const shipment = await getShipment(req, shipmentId);
    await getUser(req, supervisorId, { mustBeSupervisor: true });

    if (shipment.status !== "AWAITING_SUP") {
      req.reject(
        409,
        "A remessa não está aguardando supervisor para liberação da 3ª contagem.",
      );
    }

    await UPDATE(Shipments)
      .set({ status: "IN_PROGRESS" })
      .where({ ID: shipmentId });

    return "3ª contagem liberada pelo supervisor.";
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

    const lastAttempt = await getLastAttempt(shipmentId);

    if (lastAttempt && lastAttempt.status !== "APPROVED") {
      await UPDATE(ConferenceAttempts)
        .set({ status: "BOX_BY_BOX" })
        .where({ ID: lastAttempt.ID });
    }

    await UPDATE(Shipments)
      .set({ status: "BOX_BY_BOX" })
      .where({ ID: shipmentId });

    await UPDATE(VolumeChecks)
      .set({ scanned: false, checked: false })
      .where({ shipment_ID: shipmentId });

    return "Fluxo caixa por caixa iniciado.";
  });

  this.on("finishBoxByBox", async (req) => {
    const { shipmentId, supervisorId, countedQuantity } = req.data;

    requireId(req, shipmentId, "shipmentId");
    requireId(req, supervisorId, "supervisorId");
    requireNonNegativeInteger(req, countedQuantity, "countedQuantity");

    await getShipment(req, shipmentId);
    await getUser(req, supervisorId, { mustBeSupervisor: true });

    await UPDATE(Shipments)
      .set({
        countedQuantity,
        status: "APPROVED",
      })
      .where({ ID: shipmentId });

    await UPDATE(VolumeChecks)
      .set({
        checked: true,
        scanned: true,
        checkedBy_ID: supervisorId,
      })
      .where({ shipment_ID: shipmentId });

    return "Conferência caixa por caixa finalizada e aprovada.";
  });
});
