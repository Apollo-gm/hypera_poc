sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "hypera/conferencia/ui/model/formatter",
  ],
  function (Controller, JSONModel, MessageToast, MessageBox, formatter) {
    "use strict";

    return Controller.extend("hypera.conferencia.ui.controller.Conference", {
      formatter: formatter,

      onInit: function () {
        // Modelo de fase (estado da máquina de conferência)
        // phases: SCAN -> COUNT -> REVEAL -> (recount: COUNT) | (await: WAITING_SUP) | done
        var oPhaseModel = new JSONModel({
          phase: "SCAN",
          totalPallets: 0,
          scannedCount: 0,
          scanProgress: 0,
          blindCount: 0,
          displayAttempt: 1,
          revealMatch: false,
          revealDiff: 0,
          revealMessage: "",
          boxCount: 0,
        });
        this.getView().setModel(oPhaseModel, "phaseModel");

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("conference")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");
        if (!oUser || !oUser.authenticated) {
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }

        var sShipmentId = oEvent.getParameter("arguments").shipmentId;
        this._sShipmentId = sShipmentId;
        this._bindShipment(sShipmentId);
        this._initPhase();
      },

      _bindShipment: function (sShipmentId) {
        var oModel = this.getView().getModel();
        var aShipments = oModel.getProperty("/Shipments") || [];
        var iIndex = -1;
        for (var i = 0; i < aShipments.length; i++) {
          if (aShipments[i].ID === sShipmentId) {
            iIndex = i;
            break;
          }
        }
        if (iIndex === -1) {
          MessageBox.error("Remessa não encontrada.");
          this.getOwnerComponent().getRouter().navTo("shipments");
          return;
        }
        this._iIndex = iIndex;
        this.getView().bindElement({ path: "/Shipments/" + iIndex });
      },

      _initPhase: function () {
        var oShip = this._getShipment();
        var oPhase = this.getView().getModel("phaseModel");
        var aPallets = oShip.pallets || [];

        // Reset scanned flag for fresh session
        var aPalletsClean = aPallets.map(function (p) {
          return Object.assign({}, p, { scanned: false });
        });
        this._setShipment(Object.assign({}, oShip, { pallets: aPalletsClean }));

        var iAttempt = (oShip.attempts || 0) + 1;
        var sStartPhase = "SCAN";

        // Se vinda da lista já com status especial:
        if (oShip.status === "AWAITING_SUP") {
          sStartPhase = "WAITING_SUP";
        } else if (oShip.status === "BOX_BY_BOX") {
          sStartPhase = "BOX_BY_BOX";
        } else if (oShip.status === "APPROVED") {
          // Já aprovada — só visualização (vamos reaproveitar REVEAL)
          oPhase.setProperty("/revealMatch", true);
          oPhase.setProperty("/blindCount", oShip.countedQuantity);
          oPhase.setProperty("/revealDiff", 0);
          oPhase.setProperty("/revealMessage", "Esta remessa já foi aprovada.");
          sStartPhase = "REVEAL";
        }

        oPhase.setProperty("/phase", sStartPhase);
        oPhase.setProperty("/totalPallets", aPalletsClean.length);
        oPhase.setProperty("/scannedCount", 0);
        oPhase.setProperty("/scanProgress", 0);
        oPhase.setProperty("/blindCount", 0);
        oPhase.setProperty(
          "/displayAttempt",
          iAttempt > 3 ? 3 : iAttempt,
        );
        oPhase.setProperty("/boxCount", 0);
      },

      _getShipment: function () {
        return this.getView().getModel().getProperty("/Shipments/" + this._iIndex);
      },

      _setShipment: function (oShip) {
        this.getView().getModel().setProperty("/Shipments/" + this._iIndex, oShip);
      },

      // ============================================================
      // FASE 1: SCAN
      // ============================================================
      onScanPallet: function () {
        var oShip = Object.assign({}, this._getShipment());
        var aPallets = (oShip.pallets || []).map(function (p) {
          return Object.assign({}, p);
        });

        // Encontra primeiro palete não escaneado e marca
        var iScanned = 0;
        var bChanged = false;
        for (var i = 0; i < aPallets.length; i++) {
          if (!aPallets[i].scanned && !bChanged) {
            aPallets[i].scanned = true;
            bChanged = true;
            MessageToast.show("✓ " + aPallets[i].tag + " lido");
          }
          if (aPallets[i].scanned) iScanned++;
        }
        oShip.pallets = aPallets;
        this._setShipment(oShip);

        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/scannedCount", iScanned);
        oPhase.setProperty(
          "/scanProgress",
          Math.round((iScanned / aPallets.length) * 100),
        );
      },

      onStartBlindCount: function () {
        var oPhase = this.getView().getModel("phaseModel");
        if (oPhase.getProperty("/scannedCount") < oPhase.getProperty("/totalPallets")) {
          MessageBox.warning("Escaneie todos os paletes antes de iniciar a contagem.");
          return;
        }
        oPhase.setProperty("/blindCount", 0);
        oPhase.setProperty("/phase", "COUNT");

        // Atualiza status da remessa pra IN_PROGRESS
        var oShip = Object.assign({}, this._getShipment(), { status: "IN_PROGRESS" });
        this._setShipment(oShip);
      },

      // ============================================================
      // FASE 2: COUNT (cega)
      // ============================================================
      onIncrement: function () {
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/blindCount", (oPhase.getProperty("/blindCount") || 0) + 1);
      },

      onDecrement: function () {
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty(
          "/blindCount",
          Math.max(0, (oPhase.getProperty("/blindCount") || 0) - 1),
        );
      },

      onConfirmBlindCount: function () {
        var oPhase = this.getView().getModel("phaseModel");
        var oShip = Object.assign({}, this._getShipment());
        var iCounted = parseInt(oPhase.getProperty("/blindCount"), 10) || 0;
        var iExpected = oShip.expectedQuantity;
        var iAttempt = (oShip.attempts || 0) + 1;

        var bMatch = iCounted === iExpected;
        var iDiff = iCounted - iExpected;

        oShip.attempts = iAttempt;
        oShip.countedQuantity = iCounted;

        if (bMatch) {
          oShip.status = "APPROVED";
        } else if (iAttempt >= 3) {
          // Após 3ª tentativa divergente → caixa por caixa
          oShip.status = "BOX_BY_BOX";
        } else if (iAttempt === 2) {
          // Após 2ª divergência → aguarda supervisor liberar 3ª
          oShip.status = "AWAITING_SUP";
        } else {
          // 1ª divergência → recontar
          oShip.status = "DIVERGENT";
        }

        this._setShipment(oShip);

        // Reveal
        oPhase.setProperty("/phase", "REVEAL");
        oPhase.setProperty("/revealMatch", bMatch);
        oPhase.setProperty("/revealDiff", (iDiff > 0 ? "+" : "") + iDiff);
        oPhase.setProperty("/displayAttempt", iAttempt > 3 ? 3 : iAttempt);

        var sMsg;
        if (bMatch) {
          sMsg = "Quantidade conferida bate com a esperada. Remessa aprovada.";
        } else if (iAttempt >= 3) {
          sMsg = "Divergência persistente após 3 tentativas. Iniciando conferência caixa por caixa.";
        } else if (iAttempt === 2) {
          sMsg = "2ª divergência identificada. É necessário aguardar liberação do supervisor.";
        } else {
          sMsg = "Divergência identificada. Realize uma nova contagem.";
        }
        oPhase.setProperty("/revealMessage", sMsg);
      },

      // ============================================================
      // RECONTAGEM (volta pra COUNT depois de divergência)
      // ============================================================
      onRecount: function () {
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/blindCount", 0);
        oPhase.setProperty("/phase", "COUNT");
      },

      onWaitSupervisor: function () {
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/phase", "WAITING_SUP");
        MessageToast.show("Comunique o supervisor.");
      },

      // ============================================================
      // SUPERVISOR ACTIONS
      // ============================================================
      onSupervisorRelease: function () {
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");
        if (!oUser || oUser.role !== "SUPERVISOR") {
          MessageBox.error("Somente supervisor pode liberar a 3ª contagem.");
          return;
        }
        // Volta pra COUNT (3ª tentativa)
        var oShip = Object.assign({}, this._getShipment(), { status: "IN_PROGRESS" });
        this._setShipment(oShip);
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/blindCount", 0);
        oPhase.setProperty("/phase", "COUNT");
        oPhase.setProperty("/displayAttempt", 3);
        MessageToast.show("3ª contagem liberada pelo supervisor.");
      },

      // ============================================================
      // BOX BY BOX
      // ============================================================
      onScanBox: function () {
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/boxCount", (oPhase.getProperty("/boxCount") || 0) + 1);
        MessageToast.show("Caixa #" + oPhase.getProperty("/boxCount") + " escaneada");
      },

      onStartBoxByBox: function () {
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");
        if (!oUser || oUser.role !== "SUPERVISOR") {
          MessageBox.error("Somente supervisor pode iniciar caixa a caixa.");
          return;
        }
        var oShip = Object.assign({}, this._getShipment(), { status: "BOX_BY_BOX" });
        this._setShipment(oShip);
        var oPhase = this.getView().getModel("phaseModel");
        oPhase.setProperty("/phase", "BOX_BY_BOX");
        oPhase.setProperty("/boxCount", 0);
      },

      onFinishBoxByBox: function () {
        var oShip = Object.assign({}, this._getShipment());
        var oPhase = this.getView().getModel("phaseModel");
        oShip.status = "APPROVED";
        oShip.countedQuantity = oPhase.getProperty("/boxCount");
        this._setShipment(oShip);
        MessageToast.show("Conferência finalizada e aprovada.");
        var that = this;
        setTimeout(function () {
          that.getOwnerComponent().getRouter().navTo("shipments");
        }, 900);
      },

      onNavBack: function () {
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");
        var sRoute = oUser && oUser.role === "SUPERVISOR" ? "monitor" : "shipments";
        this.getOwnerComponent().getRouter().navTo(sRoute);
      },
    });
  },
);
