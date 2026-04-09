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
  AWAITING_SUP;
  BOX_BY_BOX;
}

type ShipmentStatus : String enum {
  PENDING;
  IN_PROGRESS;
  APPROVED;
  DIVERGENT;
  AWAITING_SUP;
  BOX_BY_BOX;
}

entity Users : managed {
  key ID   : UUID;
      name : String(100);
      email : String(120);
      role : Role;
}

entity UserAuthorizedDocks : managed {
  key ID : UUID;
      user : Association to Users;
      dock : String(20);
}

entity Shipments : managed {
  key ID                : UUID;
      transportDocument : String(40);
      shipmentNumber    : String(40);
      orderNumber       : String(40);
      product           : String(120);
      carrier           : String(100);
      carrierPlate      : String(20);
      dock              : String(20);
      destination       : String(120);
      expectedQuantity  : Integer;
      countedQuantity   : Integer default 0;
      status            : ShipmentStatus default 'PENDING';
      attempts          : Integer default 0;
      palletTag         : String(60);
      createdAt         : Timestamp;
      lastUpdate        : Timestamp;
      notes             : String(500);
      operator          : String(100);
}

entity ShipmentPallets : managed {
  key ID      : UUID;
      shipment : Association to Shipments;
      tag      : String(40);
      barcode  : String(40);
      lot      : String(40);
      scanned  : Boolean default false;
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

entity ShipmentHistory : managed {
  key ID               : UUID;
      shipment         : Association to Shipments;
      attemptNumber    : Integer;
      countedQuantity  : Integer;
      result           : AttemptStatus;
      divergenceReason : String(500);
      userName         : String(100);
      performedAt      : Timestamp;
}

entity VolumeChecks : managed {
  key ID            : UUID;
      shipment      : Association to Shipments;
      attempt       : Association to ConferenceAttempts;
      boxIdentifier : String(80);
      checked       : Boolean default true;
      checkedBy     : Association to Users;
}