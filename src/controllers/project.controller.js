import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";


// Create a new project(whoever creates the project become the admin by default)
const createProject = asyncHandler(async(req, res, next) => {
    const {name, description} = req.body;

    // Create Project
    const project = await Project.create({
        name,
        description,
        createdBy: new mongoose.Types.ObjectId(req.user._id)
    })

    // Add the creator of the project to the projectMember document and make him admin
    await ProjectMember.create({
        user: new mongoose.Types.ObjectId(req.user._id),
        project: new mongoose.Types.ObjectId(project._id),
        role: UserRolesEnum.ADMIN
    })

    return res
            .status(201)
            .json(
                new ApiResponse(201, project, "Project created successfully")
            )
})


// Find the projects the logged in user is a part of, and also show basic details of that project, along with the number of members in the project.
const getProjects = asyncHandler(async(req, res, next) => {
    const projects = await ProjectMember.aggregate([
        {
            $match:{
                user: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
                pipeline: [
                    {
                        $lookup: {
                            from: "projectmembers",
                            localField: "_id",
                            foreignField: "project",
                            as: "projectmembers"
                        }
                    },
                    {
                        $addFields: {
                            members: {
                                $size: "$projectmembers"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$project"
        },
        {
            $project: {
                _id: 0,
                role: 1,
                project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    members: 1,
                    createdAt: 1,
                    createdBy: 1
                }
            }
        }
    ])

    return res
            .status(200)
            .json(
                new ApiResponse(200, projects, "Projects fetched successfully")
            )
})


// Fetch a project using projectId
const getProjectById = asyncHandler(async(req, res, next) => {
    const {projectId} = req.params

    const project = await Project.findById(projectId)

    if(!project){
        throw new ApiError(404, "Project Not Found");
    }

    return res
            .status(200)
            .json(
                new ApiResponse(200, project, "Project fetched successfully")
            )
})


// Update a project using projectId
const updateProject = asyncHandler(async(req, res, next) => {
    const { name, description } = req.body;
    const { projectId } = req.params;

    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        name,
        description,
      },
      {
        new: true,
      },
    );

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, project, "Project Updated Successfully"));
})

// Delete a project using project id
const deleteProject = asyncHandler(async(req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findByIdAndDelete(projectId);

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, project, "Project deleted successfully"));
})

// Adds a user to a project (or updates their role if they’re already in it)
const addMembersToProject = asyncHandler(async(req, res, next) => {
    const {email, role} = req.body;
    const {projectId} = req.params;

    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    await ProjectMember.findOneAndUpdate(
      {
        user: new mongoose.Types.ObjectId(user._id),
        project: new mongoose.Types.ObjectId(projectId),
      },
      {
        user: new mongoose.Types.ObjectId(user._id),
        project: new mongoose.Types.ObjectId(projectId),
        role: role
      },
      {
        new: true,
        upsert: true
      }
    );


    return res
            .status(201)
            .json(
                new ApiResponse(201, {}, "Project member added successfully")
            );
})


// Get all members of a specific project, along with their user details and role.
const getProjectMembers = asyncHandler(async(req, res, next) => {
    const {projectId} = req.params;
    const project = await Project.findById(projectId);

    if(!project){
        throw new ApiError(404, "Project not found");
    }


    const projectMembers = await ProjectMember.aggregate([
        {
            $match:{
                project: new mongoose.Types.ObjectId(projectId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
                pipeline: [
                    {
                        $project:{
                            _id: 1,
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                user:{
                    $arrayElemAt: ["$user", 0]
                }
            }
        },
        {
            $project: {
                project: 1,
                user: 1,
                role: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])


    return res
            .status(200)
            .json(
                new ApiResponse(200, projectMembers, "Project members fetched")
            )
})

// Update member role in a project
const updateMemberRole = asyncHandler(async(req, res, next) => {
    const {projectId, userId} = req.params;
    const {newRole} = req.body;

    if(!AvailableUserRole.includes(newRole)){
        throw new ApiError(400, "Invalid Role")
    }

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId)
    })

    if(!projectMember){
        throw new ApiError(400, "Project member not found")
    }

    projectMember = await ProjectMember.findByIdAndUpdate(
        projectMember._id,
        {
            role: newRole
        },
        {
            new: true
        }
    )

    if(!projectMember){
        throw new ApiError(400, "Project member not found")
    }

    return res
      .status(200)
      .json(new ApiResponse(200, projectMembers, "Project member role updated successfully"));
})


// Delete a member from project
const deleteMember = asyncHandler(async(req, res, next) => {
    const { projectId, userId } = req.params;

    let projectMember = await ProjectMember.findOne({
      project: new mongoose.Types.ObjectId(projectId),
      user: new mongoose.Types.ObjectId(userId),
    });

    if (!projectMember) {
      throw new ApiError(400, "Project member not found");
    }

    projectMember = await ProjectMember.findByIdAndDelete(projectMember._id);

    if (!projectMember) {
      throw new ApiError(400, "Project member not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          projectMembers,
          "Project member deleted successfully",
        ),
      );
})

export {addMembersToProject, createProject, deleteMember, getProjects, getProjectById, getProjectMembers, updateProject, updateMemberRole, deleteProject}