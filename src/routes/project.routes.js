import { Router } from "express";
import { addMembersToProject,
  createProject,
  deleteMember,
  getProjects,
  getProjectById,
  getProjectMembers,
  updateProject,
  updateMemberRole,
  deleteProject,
} from "../controllers/project.controller.js";
import { validate } from "../middlewares/validator.middleware.js";
import {createProjectValidator, addMemberToProjectValidator} from "../validators/index.js";
import { verifyJWT, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();


// All routes below this use verifyJWT first
router.use(verifyJWT)


// Can serve both GET and POST request for "/api/v1/projects"
// GET - Fetch all the projects the current user is part of.
// POST - Create new projects
router.route("/")
      .get(getProjects)
      .post(createProjectValidator(), validate, createProject)



// GET - Fetch projects using projectId
// PUT - Update projects - Only ADMIN has delete access
// DELETE - Delete projects - Only ADMIN has delete access
router.route("/:projectId")
      .get(validateProjectPermission(AvailableUserRole), getProjectById)
      .put(validateProjectPermission([UserRolesEnum.ADMIN]), createProjectValidator(), validate, updateProject)
      .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteProject)


// GET - Fetch project members using projectId
// POST - Add members to project - Only ADMIN has add member access
router.route("/:projectId/members")
      .get(getProjectMembers)
      .post(validateProjectPermission([UserRolesEnum.ADMIN]), addMemberToProjectValidator(), validate, addMembersToProject)


// PUT - Update role of a member - Only ADMIN has update role access
// DELETE - Remove a member from project - Only ADMIN has delete member access
router.route("/:projectId/members/:userId")
      .put(validateProjectPermission([UserRolesEnum.ADMIN]), updateMemberRole)
      .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteMember)


export default router