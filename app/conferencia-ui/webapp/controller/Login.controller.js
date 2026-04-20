sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast"],
  function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("hypera.conferencia.ui.controller.Login", {
      onInit: function () {
        this._sSelectedRole = "COLABORADOR";

        // Click handlers nos cards de perfil
        var that = this;
        var oColab = this.byId("roleColab");
        var oSup = this.byId("roleSup");
        if (oColab && oColab.attachBrowserEvent) {
          oColab.attachBrowserEvent("click", function () {
            that._selectRole("COLABORADOR");
          });
          oSup.attachBrowserEvent("click", function () {
            that._selectRole("SUPERVISOR");
          });
        }
      },

      _selectRole: function (sRole) {
        this._sSelectedRole = sRole;
        var oColab = this.byId("roleColab");
        var oSup = this.byId("roleSup");
        if (sRole === "COLABORADOR") {
          oColab.addStyleClass("hyperaRoleCardActive");
          oSup.removeStyleClass("hyperaRoleCardActive");
        } else {
          oSup.addStyleClass("hyperaRoleCardActive");
          oColab.removeStyleClass("hyperaRoleCardActive");
        }
      },

      onLogin: function () {
        var oComponent = this.getOwnerComponent();
        var oAppModel = oComponent.getModel("app");
        var sName = (this.byId("userNameInput").getValue() || "").trim() || "Operador";
        var sRole = this._sSelectedRole || "COLABORADOR";

        // Busca dados completos do user no mock (incluindo authorizedDocks)
        var oDataModel = oComponent.getModel();
        var aUsers = (oDataModel && oDataModel.getProperty("/Users")) || [];
        var oUserMock = null;
        for (var i = 0; i < aUsers.length; i++) {
          if (aUsers[i].role === sRole) { oUserMock = aUsers[i]; break; }
        }

        oAppModel.setProperty("/currentUser", {
          ID: oUserMock ? oUserMock.ID : (sRole === "SUPERVISOR"
              ? "22222222-2222-2222-2222-222222222222"
              : "11111111-1111-1111-1111-111111111111"),
          name: sName,
          role: sRole,
          authenticated: true,
          authorizedDocks: oUserMock ? oUserMock.authorizedDocks : [],
        });

        MessageToast.show("Bem-vindo, " + sName);
        var sRoute = sRole === "SUPERVISOR" ? "monitor" : "shipments";
        oComponent.getRouter().navTo(sRoute);
      },
    });
  },
);
