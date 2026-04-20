sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "hypera/conferencia/ui/model/formatter",
  ],
  function (Controller, JSONModel, Filter, FilterOperator, MessageToast, formatter) {
    "use strict";

    return Controller.extend("hypera.conferencia.ui.controller.Monitor", {
      formatter: formatter,

      onInit: function () {
        this._sQuery = "";
        this._sStatusFilter = "ALL";

        var oMonitorModel = new JSONModel({
          total: 0,
          pending: 0,
          inProgress: 0,
          approved: 0,
          divergent: 0,
          awaitingSup: 0,
          boxByBox: 0,
        });
        this.getView().setModel(oMonitorModel, "monitor");

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("monitor")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");
        if (!oUser || !oUser.authenticated) {
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }
        if (oUser.role !== "SUPERVISOR") {
          this.getOwnerComponent().getRouter().navTo("shipments");
          return;
        }
        this._refreshKpis();
      },

      _refreshKpis: function () {
        var oModel = this.getView().getModel();
        var aShipments = oModel.getProperty("/Shipments") || [];
        var oKpi = {
          total: aShipments.length,
          pending: 0,
          inProgress: 0,
          approved: 0,
          divergent: 0,
          awaitingSup: 0,
          boxByBox: 0,
        };
        for (var i = 0; i < aShipments.length; i++) {
          var s = aShipments[i].status;
          if (s === "PENDING") oKpi.pending++;
          else if (s === "IN_PROGRESS") oKpi.inProgress++;
          else if (s === "APPROVED") oKpi.approved++;
          else if (s === "DIVERGENT") oKpi.divergent++;
          else if (s === "AWAITING_SUP") oKpi.awaitingSup++;
          else if (s === "BOX_BY_BOX") oKpi.boxByBox++;
        }
        this.getView().getModel("monitor").setData(oKpi);

        // Atualiza badge do sino
        this._updateBell(oKpi.awaitingSup);
      },

      _updateBell: function (iCount) {
        var oBell = this.byId("bellBtn");
        if (!oBell) return;
        if (iCount > 0) {
          oBell.addStyleClass("hyperaBellActive");
          oBell.setTooltip(iCount + " ações pendentes");
        } else {
          oBell.removeStyleClass("hyperaBellActive");
          oBell.setTooltip("Sem ações pendentes");
        }
      },

      onBellPress: function () {
        // Filtra a lista por AWAITING_SUP e dá scroll pro topo do alerta
        this._sStatusFilter = "AWAITING_SUP";
        var oMap = {
          chipAll: "ALL",
          chipPending: "PENDING",
          chipInProgress: "IN_PROGRESS",
          chipDivergent: "DIVERGENT",
          chipAwaitingSup: "AWAITING_SUP",
          chipBoxByBox: "BOX_BY_BOX",
          chipApproved: "APPROVED",
        };
        var that = this;
        Object.keys(oMap).forEach(function (k) {
          var oC = that.byId(k);
          if (oC) {
            oC.removeStyleClass("hyperaChipActive");
            oC.setType("Default");
          }
        });
        var oActive = this.byId("chipAwaitingSup");
        if (oActive) {
          oActive.addStyleClass("hyperaChipActive");
          oActive.setType("Emphasized");
        }
        this._applyFilters();
      },

      onSearch: function (oEvent) {
        this._sQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim();
        this._applyFilters();
      },

      onFilterSelect: function (oEvent) {
        this._sStatusFilter = oEvent.getParameter("key");
        this._applyFilters();
      },

      onChipPress: function (oEvent) {
        var oBtn = oEvent.getSource();
        var sId = oBtn.getId();
        var oMap = {
          chipAll: "ALL",
          chipPending: "PENDING",
          chipInProgress: "IN_PROGRESS",
          chipDivergent: "DIVERGENT",
          chipAwaitingSup: "AWAITING_SUP",
          chipBoxByBox: "BOX_BY_BOX",
          chipApproved: "APPROVED",
        };
        var sKey = null;
        Object.keys(oMap).forEach(function (k) {
          if (sId.indexOf(k) !== -1) sKey = oMap[k];
        });
        if (!sKey) return;

        this._sStatusFilter = sKey;

        var that = this;
        Object.keys(oMap).forEach(function (k) {
          var oC = that.byId(k);
          if (oC) {
            oC.removeStyleClass("hyperaChipActive");
            oC.setType("Default");
          }
        });
        oBtn.addStyleClass("hyperaChipActive");
        oBtn.setType("Emphasized");

        this._applyFilters();
      },

      _applyFilters: function () {
        var aFilters = [];
        if (this._sStatusFilter && this._sStatusFilter !== "ALL") {
          aFilters.push(new Filter("status", FilterOperator.EQ, this._sStatusFilter));
        }
        if (this._sQuery) {
          var q = this._sQuery;
          aFilters.push(
            new Filter({
              filters: [
                new Filter("shipmentNumber", FilterOperator.Contains, q),
                new Filter("product", FilterOperator.Contains, q),
                new Filter("dock", FilterOperator.Contains, q),
                new Filter("carrier", FilterOperator.Contains, q),
                new Filter("carrierPlate", FilterOperator.Contains, q),
                new Filter("destination", FilterOperator.Contains, q),
              ],
              and: false,
            }),
          );
        }
        var oList = this.byId("monitorList");
        var oBinding = oList.getBinding("items");
        if (oBinding) {
          oBinding.filter(aFilters.length ? new Filter({ filters: aFilters, and: true }) : []);
        }
      },

      onItemPress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext();
        var sId = oCtx.getProperty("ID");
        this.getOwnerComponent().getRouter().navTo("conference", { shipmentId: sId });
      },

      onReleaseThird: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext();
        var sId = oCtx.getProperty("ID");
        this.getOwnerComponent().getRouter().navTo("conference", { shipmentId: sId });
        MessageToast.show("Abra a remessa e clique em 'Liberar 3ª contagem'");
      },

      onLogout: function () {
        var oAppModel = this.getOwnerComponent().getModel("app");
        oAppModel.setProperty("/currentUser", {
          ID: null,
          name: "",
          role: "COLABORADOR",
          authenticated: false,
        });
        this.getOwnerComponent().getRouter().navTo("login");
      },
    });
  },
);
