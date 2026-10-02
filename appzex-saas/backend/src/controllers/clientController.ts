import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import { findAgencyClientOrThrow } from '../repositories/tenantRepository';
import * as activityService from '../services/activityService';
import * as clientService from '../services/clientService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import {
  createClientSchema,
  createPortalUserSchema,
  listClientsQuery,
  updateClientSchema,
} from '../validators/clientValidators';
import { idParams } from '../validators/common';
import { listActivityQuery } from '../validators/workValidators';

export async function list(req: Request, res: Response) {
  const query = validate(listClientsQuery, req.query);
  sendOk(res, await clientService.listClients(getAgencyContext(req).agencyId, query));
}

export async function get(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await clientService.getClient(getAgencyContext(req).agencyId, id));
}

export async function create(req: Request, res: Response) {
  const input = validate(createClientSchema, req.body);
  sendCreated(res, await clientService.createClient(getAgencyContext(req), input));
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(updateClientSchema, req.body);
  sendOk(res, await clientService.updateClient(getAgencyContext(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  await clientService.deleteClient(getAgencyContext(req), id);
  sendOk(res, { deleted: true });
}

export async function createPortalUser(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(createPortalUserSchema, req.body);
  sendCreated(res, await clientService.createPortalUser(getAgencyContext(req), id, input));
}

/** Timeline of events for one client company and its projects. */
export async function activity(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const ctx = getAgencyContext(req);
  // Ownership check first: a client id from another agency 404s here.
  await findAgencyClientOrThrow(ctx.agencyId, id);
  const query = validate(listActivityQuery, req.query);
  sendOk(res, await activityService.listClientActivity(ctx.agencyId, id, query));
}
