namespace hypera.conferencia;

using { managed } from '@sap/cds/common';

type Role : String enum {
  COLABORADOR;
  SUPERVISOR;
}

type AttemptStatus : String enum {
  OPEN;
  APPROVED;
  DIVERGENT;
  BOX_BY_BOX;
}

type ShipmentStatus : String enum {
  PENDING;
  IN_PROGRESS;
  AWAITING_SUP;
  APPROVED;
  DIVERGENT;
  BOX_BY_BOX;
}

entity Users : managed {
  key ID   : UUID;
      name : String(100);
      email: String(120);
      role : Role;
}

entity Shipments : managed {
  key ID                : UUID;
      transportDocument : String(40);
      shipmentNumber    : String(40);
      orderNumber       : String(40);
      expectedQuantity  : Integer;
      countedQuantity   : Integer default 0;
      status            : ShipmentStatus default 'PENDING';
      palletTag         : String(60);
      notes             : String(500);
}

entity ConferenceAttempts : managed {
  key ID               : UUID;
      shipment         : Association to Shipments;
      attemptNumber    : Integer;
      countedQuantity  : Integer;
      status           : AttemptStatus default 'OPEN';
      divergenceReason : String(500);
      countedBy        : Association to Users;
      approvedBy       : Association to Users;
}

entity VolumeChecks : managed {
  key ID            : UUID;
      shipment      : Association to Shipments;
      attempt       : Association to ConferenceAttempts;
      boxIdentifier : String(80);
      checked       : Boolean default true;
      checkedBy     : Association to Users;
}