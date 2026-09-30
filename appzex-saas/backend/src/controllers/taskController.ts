import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import * as taskService from '../services/taskService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { commentSchema, idParams, projectIdParams, taskIdParams } from '../validators/common';
import { createTaskSchema, listTasksQuery, taskSummaryQuery, updateTaskSchema } from '../validators/workValidators';

export async function list(req: Request, res: Response) {
  const query = validate(listTasksQuery, req.query);
  sendOk(res, await taskService.listTasks(getAgencyContext(req), query));
}

export async function summary(req: Request, res: Response) {
  const filters = validate(taskSummaryQuery, req.query);
  sendOk(res, await taskService.getTaskSummary(getAgencyContext(req), filters));
}

export async function listForProject(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const query = validate(listTasksQuery, req.query);
  sendOk(res, await taskService.listProjectTasks(getAgencyContext(req), projectId, query));
}

export async function get(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await taskService.getTask(getAgencyContext(req).agencyId, id));
}

export async function create(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const input = validate(createTaskSchema, req.body);
  sendCreated(res, await taskService.createTask(getAgencyContext(req), projectId, input));
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(updateTaskSchema, req.body);
  sendOk(res, await taskService.updateTask(getAgencyContext(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, { deleted: true, ...(await taskService.deleteTask(getAgencyContext(req), id)) });
}

export async function listComments(req: Request, res: Response) {
  const { taskId } = validate(taskIdParams, req.params);
  sendOk(res, await taskService.listTaskComments(getAgencyContext(req).agencyId, taskId));
}

export async function addComment(req: Request, res: Response) {
  const { taskId } = validate(taskIdParams, req.params);
  const { content } = validate(commentSchema, req.body);
  sendCreated(res, await taskService.addTaskComment(getAgencyContext(req), taskId, content));
}
