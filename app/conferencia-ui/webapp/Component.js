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

        this.getRouter().initialize();
      },
    });
  },
);
