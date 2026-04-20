sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Item",
    "hypera/conferencia/ui/model/formatter",
  ],
  function (Controller, Filter, FilterOperator, Item, formatter) {
    "use strict";

    return Controller.extend("hypera.conferencia.ui.controller.ShipmentList", {
      formatter: formatter,

      onInit: function () {
        this._sQuery = "";
        this._sStatusFilter = "ALL";
        this._sDockFilter = "ALL";
        this._sCarrierFilter = "ALL";
        this._bFooterCountBound = false;

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("shipments")
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

        this._populateSelects();
        this._syncChipState();
        this._applyFilters();

        var oList = this.byId("shipmentList");
        var oBinding = oList && oList.getBinding("items");

        if (oBinding && !this._bFooterCountBound) {
          oBinding.attachChange(this._updateFooterCount, this);
          this._bFooterCountBound = true;
        }

        this._updateFooterCount();
      },

      _populateSelects: function () {
        var oModel = this.getView().getModel();
        var aShipments = (oModel && oModel.getProperty("/Shipments")) || [];
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");

        var aAuthorized = (oUser && oUser.authorizedDocks) || [];
        var oDockSet = {};
        var oCarrierSet = {};

        for (var i = 0; i < aShipments.length; i++) {
          var oShipment = aShipments[i];

          if (
            oUser &&
            oUser.role === "COLABORADOR" &&
            aAuthorized.length &&
            aAuthorized.indexOf(oShipment.dock) === -1
          ) {
            continue;
          }

          if (oShipment.dock) {
            oDockSet[oShipment.dock] = true;
          }

          if (oShipment.carrier) {
            oCarrierSet[oShipment.carrier] = true;
          }
        }

        var oDockSelect = this.byId("dockSelect");
        var oCarrierSelect = this.byId("carrierSelect");

        if (oDockSelect) {
          oDockSelect.removeAllItems();
          oDockSelect.addItem(new Item({ key: "ALL", text: "Todas as docas" }));

          Object.keys(oDockSet)
            .sort()
            .forEach(function (sKey) {
              oDockSelect.addItem(new Item({ key: sKey, text: sKey }));
            });

          oDockSelect.setSelectedKey(this._sDockFilter || "ALL");
        }

        if (oCarrierSelect) {
          oCarrierSelect.removeAllItems();
          oCarrierSelect.addItem(
            new Item({ key: "ALL", text: "Todas as transportadoras" }),
          );

          Object.keys(oCarrierSet)
            .sort()
            .forEach(function (sKey) {
              oCarrierSelect.addItem(new Item({ key: sKey, text: sKey }));
            });

          oCarrierSelect.setSelectedKey(this._sCarrierFilter || "ALL");
        }
      },

      _updateFooterCount: function () {
        var oList = this.byId("shipmentList");
        var oText = this.byId("shipmentTotalText");

        if (!oList || !oText) {
          return;
        }

        var oBinding = oList.getBinding("items");
        var iCount = oBinding ? oBinding.getLength() : 0;

        oText.setText("Total: " + iCount + " remessas");
      },

      _syncChipState: function () {
        var oMap = {
          chipAll: "ALL",
          chipPending: "PENDING",
          chipInProgress: "IN_PROGRESS",
          chipApproved: "APPROVED",
          chipDivergent: "DIVERGENT",
          chipBoxByBox: "BOX_BY_BOX",
        };

        Object.keys(oMap).forEach(function (sId) {
          var oButton = this.byId(sId);
          if (oButton) {
            oButton.setType(
              oMap[sId] === this._sStatusFilter ? "Emphasized" : "Transparent",
            );
          }
        }, this);
      },

      onSearch: function (oEvent) {
        this._sQuery = (
          oEvent.getParameter("newValue") ||
          oEvent.getParameter("query") ||
          ""
        ).trim();

        this._applyFilters();
      },

      onChipPress: function (oEvent) {
        var oBtn = oEvent.getSource();
        var sId = oBtn.getId();
        var oMap = {
          chipAll: "ALL",
          chipPending: "PENDING",
          chipInProgress: "IN_PROGRESS",
          chipApproved: "APPROVED",
          chipDivergent: "DIVERGENT",
          chipBoxByBox: "BOX_BY_BOX",
        };

        var sKey = null;

        Object.keys(oMap).forEach(function (sChipId) {
          if (sId.indexOf(sChipId) !== -1) {
            sKey = oMap[sChipId];
          }
        });

        if (!sKey) {
          return;
        }

        this._sStatusFilter = sKey;
        this._syncChipState();
        this._applyFilters();
      },

      onDockChange: function (oEvent) {
        var oItem = oEvent.getParameter("selectedItem");
        this._sDockFilter = oItem ? oItem.getKey() : "ALL";
        this._applyFilters();
      },

      onCarrierChange: function (oEvent) {
        var oItem = oEvent.getParameter("selectedItem");
        this._sCarrierFilter = oItem ? oItem.getKey() : "ALL";
        this._applyFilters();
      },

      _applyFilters: function () {
        var oList = this.byId("shipmentList");
        var oBinding = oList && oList.getBinding("items");

        if (!oBinding) {
          return;
        }

        var aFilters = [];
        var oUser = this.getOwnerComponent()
          .getModel("app")
          .getProperty("/currentUser");

        if (
          oUser &&
          oUser.role === "COLABORADOR" &&
          oUser.authorizedDocks &&
          oUser.authorizedDocks.length
        ) {
          var aDockFilters = oUser.authorizedDocks.map(function (sDock) {
            return new Filter("dock", FilterOperator.EQ, sDock);
          });

          aFilters.push(new Filter({ filters: aDockFilters, and: false }));
        }

        if (this._sStatusFilter && this._sStatusFilter !== "ALL") {
          aFilters.push(
            new Filter("status", FilterOperator.EQ, this._sStatusFilter),
          );
        }

        if (this._sDockFilter && this._sDockFilter !== "ALL") {
          aFilters.push(
            new Filter("dock", FilterOperator.EQ, this._sDockFilter),
          );
        }

        if (this._sCarrierFilter && this._sCarrierFilter !== "ALL") {
          aFilters.push(
            new Filter("carrier", FilterOperator.EQ, this._sCarrierFilter),
          );
        }

        if (this._sQuery) {
          var sQ = this._sQuery;

          aFilters.push(
            new Filter({
              filters: [
                new Filter("shipmentNumber", FilterOperator.Contains, sQ),
                new Filter("product", FilterOperator.Contains, sQ),
                new Filter("dock", FilterOperator.Contains, sQ),
                new Filter("carrier", FilterOperator.Contains, sQ),
                new Filter("destination", FilterOperator.Contains, sQ),
                new Filter("transportDocument", FilterOperator.Contains, sQ),
                new Filter("orderNumber", FilterOperator.Contains, sQ),
                new Filter("carrierPlate", FilterOperator.Contains, sQ),
              ],
              and: false,
            }),
          );
        }

        if (aFilters.length === 0) {
          oBinding.filter([]);
        } else {
          oBinding.filter(new Filter({ filters: aFilters, and: true }));
        }

        this._updateFooterCount();
      },

      onItemPress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext();
        if (!oCtx) {
          return;
        }

        this.getOwnerComponent()
          .getRouter()
          .navTo("conference", {
            shipmentId: oCtx.getProperty("ID"),
          });
      },

      onLogout: function () {
        this.getOwnerComponent().getModel("app").setProperty("/currentUser", {
          name: "",
          role: "",
          authenticated: false,
          authorizedDocks: [],
        });

        this.getOwnerComponent().getRouter().navTo("login");
      },
    });
  },
);
