import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import env from "dotenv";
import { upload } from "../middlewares/multer.middleware.js";


// Fetch tasks using project id
const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const tasks = await Task.find({
    project: new mongoose.Types.ObjectId(projectId),
  }).populate("assignedTo", "avatar username fullName");

  if (!tasks) {
    throw new ApiError(404, "Task not found");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, tasks, "Task fetched successfully"));
});


// Create a task
const createTask = asyncHandler(async (req, res) => {
    const { title, description, assignedTo, status } = req.body;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const files = req.files || [];

    const attachments = files.map((file) => {
        return {
        url: `${process.env.SERVER_URL}/images/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
        };
    });

    const task = await Task.create({
        title,
        description,
        project: new mongoose.Types.ObjectId(projectId),

        // assignedTo receives a single user --> Only one user can be assigned to a specific task
        assignedTo: assignedTo? new mongoose.Types.ObjectId(assignedTo): undefined,
        status,
        assignedBy: new mongoose.Types.ObjectId(req.user._id),
        attachments,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, task, "Task created successfully"));
});


// Fetch tasks using task id
const getTaskById = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.aggregate([

        // Find task with the matching task id
        {
            $match: {
                _id: new mongoose.Types.ObjectId(taskId),
                project: new mongoose.Types.ObjectId(projectId)
            }
        },

        // Join the matching task with the list of assigned users
        {
        $lookup: {
            from: "users",
            localField: "assignedTo",
            foreignField: "_id",
            as: "assignedTo",
            pipeline: [
            {
                // For shortlisted users, show only id, username, fullname, avatar
                $project: {
                _id: 1,
                username: 1,
                fullName: 1,
                avatar: 1,
                },
            },
            ],
        },
        },

        // Join using the matched task id with subtasks.task(which is of type ObjectId)
        {
        $lookup: {
            from: "subtasks",
            localField: "_id",
            foreignField: "task",
            as: "subtasks",
            pipeline: [{

                /* With the joined results, join using subtasks.createdBy = users._id
                    Note that it returns only a single user since a task is created only by a single user
                */
                $lookup: {
                    from: "users",
                    localField: "createdBy",
                    foreignField: "_id",
                    as: "createdBy",
                    pipeline: [

                        // Keep only id, username, fullname, avatar
                        {
                            $project: {
                                _id: 1,
                                username: 1,
                                fullName: 1,
                                avatar: 1
                            }
                        },

                        // Since lookup results in an array and we have only one element inside it, we extract it out
                        {
                            $addFields: {
                                createdBy:{
                                    $arrayElemAt: ["createdBy", 0]
                                }
                            }
                        }
                    ]
                }
            }],
        },
        },

        // The DB is designed such that only one task is assigned to a specific user
        {
            $addFields:{
                assignedTo:{
                    $arrayElemAt: ["assignedTo", 0]
                }
            }
        }
    ]);


    if(!task || task.length === 0){
        throw new ApiError(404, "Task not found")
    }

    return res
            .status(200)
            .json(
                new ApiResponse(200, task[0], "Task fetched successfully")
            )
});


// Update task using projectId and taskId
const updateTask = asyncHandler(async (req, res) => {
    const {projectId, taskId} = req.params;
    const {title, description} = req.body;

    const task = await Task.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(taskId),
            project: new mongoose.Types.ObjectId(projectId)
        },
        {
            title,
            description
        },
        {
            new: true
        }
    )

    if(!task){
        throw new ApiError(404, "Task not found")
    }

    return res
            .status(200)
            .json(
                new ApiResponse(200, task, "Task updated successfully")
            )

});

// Delete task using projectId and taskId
const deleteTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOneAndDelete(
      {
        _id: new mongoose.Types.ObjectId(taskId),
        project: new mongoose.Types.ObjectId(projectId),
      }
    );

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, task, "Task deleted successfully"));
});




const createSubTask = asyncHandler(async (req, res) => {
  // test
});

const updateSubTask = asyncHandler(async (req, res) => {
  // test
});

const deleteSubtask = asyncHandler(async (req, res) => {
  // test
});

export {
  createSubTask,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateSubTask,
  deleteTask,
  deleteSubtask,
};
