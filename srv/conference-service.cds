using { hypera.conferencia as db } from '../db/schema';

@requires: 'authenticated-user'
service ConferenceService {

  @restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Supervisor' }
  ]
  entity Users as projection on db.Users;

  @restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Supervisor' }
  ]
  entity Shipments as projection on db.Shipments;

  @restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Supervisor' }
  ]
  entity ConferenceAttempts as projection on db.ConferenceAttempts;

  @restrict: [
    { grant: 'READ', to: 'authenticated-user' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Supervisor' }
  ]
  entity VolumeChecks as projection on db.VolumeChecks;

  @requires: 'authenticated-user'
  action startConference(shipmentId : UUID, userId : UUID) returns String;

  @requires: 'authenticated-user'
  action submitCount(
    shipmentId       : UUID,
    userId           : UUID,
    countedQuantity  : Integer,
    divergenceReason : String
  ) returns String;

  @requires: 'Supervisor'
  action approveAttempt(attemptId : UUID, supervisorId : UUID) returns String;

  @requires: 'Supervisor'
  action releaseThirdCount(shipmentId : UUID, supervisorId : UUID) returns String;

  @requires: 'Supervisor'
  action startBoxByBox(shipmentId : UUID, supervisorId : UUID) returns String;

  @requires: 'Supervisor'
  action finishBoxByBox(
    shipmentId      : UUID,
    supervisorId    : UUID,
    countedQuantity : Integer
  ) returns String;
}