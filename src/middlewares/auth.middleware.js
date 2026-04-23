import {  User } from "../models/user.models.js"
import {ApiError} from "../utils/api-error.js"
import {asyncHandler} from "../utils/async-handler.js"
import jwt from 'jsonwebtoken'
import env from 'dotenv'
import { ProjectMember } from "../models/projectmember.models.js"

export const verifyJWT = asyncHandler(async (req, res, next) => {

    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");


    if(!token){
        throw new ApiError(401, "Unauthorized request");
    }

    try{

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
        )

        if(!user){
            throw new ApiError(401, "Invalid Access Token");
        }

        req.user = user;
        next()

    }
    catch(error){
        throw new ApiError(401, "Invalid Access Token");
    }
})


export const validateProjectPermission = (roles = []) => {
    return asyncHandler(async(req, res, next) => {
        const {projectId} = req.params;

        if(!projectId){
            throw new ApiError(400, "Project ID is missing")
        }

        const project = await ProjectMember.findOne({
            project: new mongoose.Types.ObjectId(projectId),
            user: new mongoose.Types.ObjectId(req.user._id)
        })

        if (!project) {
          throw new ApiError(400, "Project not found");
        }

        const givenRole = project?.role;

        req.user.role = givenRole

        if(!roles.includes(givenRole)){
            throw new ApiError(403, "You do not have permisson to perform this action")
        }

        next();
    })
}