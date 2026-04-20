sap.ui.define(
  ["sap/ui/core/UIComponent", "sap/ui/model/json/JSONModel"],
  function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("hypera.conferencia.ui.Component", {
      metadata: {
        manifest: "json",
      },

      init: function () {
        UIComponent.prototype.init.apply(this, arguments);

        var oAppModel = new JSONModel({
          currentUser: {
            ID: null,
            name: "",
            role: "COLABORADOR",
            authenticated: false,
          },
          ui: {
            busy: false,
          },
        });
        this.setModel(oAppModel, "app");

        // MODO MOCK: conexão real ao backend CAP comentada.
        // Em produção, substituir pelo fetch abaixo para carregar dados do HANA via OData.
        // fetch("/ui/mockdata").then(r => r.json()).then(data => this.getModel().setData(data));
        //
        // Simula latência de rede (0.3s) na carga inicial dos dados.
        oAppModel.setProperty("/ui/busy", true);
        setTimeout(function () {
          oAppModel.setProperty("/ui/busy", false);
        }, 300);

        this.getRouter().initialize();
      },

      // Simula chamada ao backend CAP com delay de 0.3s.
      // Em produção, substituir pelo fetch/OData real e remover o setTimeout.
      simulateBackend: function (fnCallback) {
        var oAppModel = this.getModel("app");
        oAppModel.setProperty("/ui/busy", true);
        setTimeout(function () {
          oAppModel.setProperty("/ui/busy", false);
          fnCallback();
        }, 300);
      },
    });
  },
);
