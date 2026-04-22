import { body } from "express-validator"
import { asyncHandler } from "../utils/async-handler.js";
import {AvailableUserRole} from "../utils/constants.js"


// User register validator
const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lowercase")
            .isLength({min: 3})
            .withMessage("Username must be atleast 3 characters long"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required"),
        body("fullName")
            .optional()
            .trim()
    ]
}

// User login validator
const userLoginValidator = () => {
    return [
        body("email")
            .notEmpty()
            .isEmail()
            .withMessage("Email is invalid"),
        body("password")
            .notEmpty()
            .withMessage("Password is required")
    ];
}


const userChangeCurrentPasswordValidator = () => {
    return[
        body("oldPassword")
            .notEmpty()
            .withMessage("Old Password is required"),
        body("newPassword")
            .notEmpty()
            .withMessage("New Password is required")
    ]
}


const userForgotPasswordValidator  = () => {
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),

    ]
}

const userResetForgotPasswordValidator = () => {
    return [
        body("newPassword")
            .notEmpty()
            .withMessage("Password is required")
    ]
}


const createProjectValidator = () => {
    return [
        body("name")
            .notEmpty()
            .withMessage("Name is required"),
        body("description")
            .optional()
    ]
}


const addMemberToProjectValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("role")
            .notEmpty()
            .withMessage("Role is required")
            .isIn(AvailableUserRole)
            .withMessage("Role is invalid")
    ]
}


export {userRegisterValidator, userLoginValidator, userChangeCurrentPasswordValidator, userForgotPasswordValidator, userResetForgotPasswordValidator, createProjectValidator, addMemberToProjectValidator}