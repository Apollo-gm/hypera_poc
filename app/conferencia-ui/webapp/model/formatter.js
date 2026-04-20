sap.ui.define([], function () {
  "use strict";

  return {
    statusText: function (sStatus) {
      var oMap = {
        PENDING: "Pendente",
        IN_PROGRESS: "Em andamento",
        APPROVED: "Aprovada",
        DIVERGENT: "Divergente",
        AWAITING_SUP: "Aguardando supervisor",
        BOX_BY_BOX: "Caixa a caixa",
      };
      return oMap[sStatus] || sStatus || "—";
    },

    statusState: function (sStatus) {
      var oMap = {
        PENDING: "None",
        IN_PROGRESS: "Information",
        APPROVED: "Success",
        DIVERGENT: "Warning",
        AWAITING_SUP: "Warning",
        BOX_BY_BOX: "Error",
      };
      return oMap[sStatus] || "None";
    },

    statusIcon: function (sStatus) {
      var oMap = {
        PENDING: "sap-icon://pending",
        IN_PROGRESS: "sap-icon://synchronize",
        APPROVED: "sap-icon://accept",
        DIVERGENT: "sap-icon://warning",
        AWAITING_SUP: "sap-icon://alert",
        BOX_BY_BOX: "sap-icon://inspect",
      };
      return oMap[sStatus] || "sap-icon://document";
    },

    formatDate: function (sDate) {
      if (!sDate) return "";
      var d = new Date(sDate);
      if (isNaN(d.getTime())) return sDate;
      var pad = function (n) { return n < 10 ? "0" + n : n; };
      return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() +
             " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    },

    progressPercent: function (iCounted, iExpected) {
      if (!iExpected || iExpected === 0) return 0;
      var pct = Math.round((iCounted / iExpected) * 100);
      return pct > 100 ? 100 : pct;
    },

    progressText: function (iCounted, iExpected) {
      return (iCounted || 0) + " / " + (iExpected || 0);
    },

    divergenceLabel: function (iCounted, iExpected) {
      var diff = (iCounted || 0) - (iExpected || 0);
      if (diff === 0) return "OK";
      if (diff > 0) return "+" + diff;
      return String(diff);
    },

    isCounterEnabled: function (sStatus) {
      return sStatus !== "APPROVED";
    },

    isApprovable: function (sStatus, sRole) {
      return (sStatus === "DIVERGENT" || sStatus === "BOX_BY_BOX") && sRole === "SUPERVISOR";
    },
  };
});
