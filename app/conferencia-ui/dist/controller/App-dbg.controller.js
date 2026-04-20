sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
  "use strict";

  return Controller.extend("hypera.conferencia.ui.controller.App", {
    onInit: function () {
      if (window.performance && window.performance.mark) {
        window.performance.mark("hypera-app-ready");
      }
    },
  });
});
