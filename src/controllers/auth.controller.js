import {User} from "../models/user.models.js"
import {ApiResponse} from "../utils/api-response.js"
import {ApiError} from "../utils/api-error.js"
import {asyncHandler} from "../utils/async-handler.js"
import {emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail} from "../utils/mail.js"
import jwt from 'jsonwebtoken'
import crypto from "crypto"



// function to generate access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        // Save document to MongoDB without any validation checking
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    }
    catch(error){
        throw new ApiError(
            500,
            "Something went wrong while generating access token"
        )
    }
}



// register endpoint
const registerUser = asyncHandler(async(req, res) => {
    const {email, username, password, role} = req.body

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists, []")
    }

    const user = await User.create({
        email,
        password,
        username,
        isEmailVerified: false
    })


    // Generate token for email
    const {unHashedToken, hashedToken, tokenExpiry} = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken
    user.emailVerificationExpiry = tokenExpiry

    await user.save({validateBeforeSave: false})

    await sendEmail(
        {
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`
            )
        }
    );

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
    );

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering a user")
    }

    res
    .status(201)
    .json(
        new ApiResponse(
            200,
            {user: createdUser},
            "User registered successfully and verification email has been sent on your email"
        )
    )
})



// login endpoint
const login = asyncHandler(async(req, res, next) => {
    const {email, password, username} = req.body;

    if(!email){
        throw new ApiError(400, "Email is required")
    }

    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(400, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser
                },
                "User logged in successfully"
            )
        )


})



// logout endpoint
const logoutUser = asyncHandler(async(req, res, next) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: ""
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                new ApiResponse(200, {}, "User logged out")
            )
})


const getCurrentUser = asyncHandler(async(req, res, next) => {
    return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    req.user,
                    "Current user fetched successfully"
                )
            )
})


// Email verification endpoint
const verifyEmail = asyncHandler(async(req, res, next) => {
    const {verificationToken} = req.params

    if(!verificationToken){
        throw new ApiError(400, "Email verification token is missing")
    }

    let hashedToken = crypto
                        .createHash("sha256")
                        .update(verificationToken)
                        .digest("hex")

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: {$gt: Date.now()}
    })

    if(!user){
        throw new ApiError(400, "Token is invalid or expired");
    }


    user.emailVerificationToken = undefined
    user.emailVerificationExpiry = undefined


    user.isEmailVerified = true

    await user.save({validateBeforeSave: false})


    return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {
                        isEmailVerified: true
                    },
                    "Email is verified"
                )
            )

})


// Resend email verification link -- protected route
const resendEmailVerification = asyncHandler(async (req, res, next) => {

    // req.user comes from verifyJWT middleware
    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    if (user.isEmailVerified) {
        throw new ApiError(409, "Email is already verified");
    }


    // Generate token for email
    const { unHashedToken, hashedToken, tokenExpiry } = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user?.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(user.username,
                            `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`,
        ),
    });


    return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "Mail has been sent to your email ID"
                )
            )
});


// Refreshing refresh token endpoint
const refreshRefreshToken = asyncHandler(async(req, res, next) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized access")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token has expired")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshTokens(user._id);


        user.refreshToken = newRefreshToken;

        await user.save()

        return res
                    .status(200)
                    .cookie("accessToken", accessToken, options)
                    .cookie("refreshToken", newRefreshToken, options)
                    .json(
                        new ApiResponse(
                            200,
                            "Refresh token refreshed"
                        )
                    )

    } catch (error) {
        throw new ApiError(401, "Invalid Refresh Token");
    }
})


// Forgot Password Mail
const forgotPasswordRequest = asyncHandler(async(req, res, next) => {

    const {email} = req.body;

    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404, "User does not exist", [])
    }

    const {unHashedToken, hashedToken, tokenExpiry} = user.generateTemporaryToken()

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;

    await user.save({validateBeforeSave: false})

    await sendEmail({
      email: user?.email,
      subject: "Password reset request",
      mailgenContent: forgotPasswordMailgenContent(
        user.username,
        `${req.protocol}://${req.get("host")}/api/v1/auth/reset-password/${unHashedToken}`,
      ),
    });

    return res
            .status(200)
            .json(
                new ApiResponse(200, {}, "Password reset mail has been sent on your email id")
            )

})


// Reset Forgot Password Endpoint
const resetForgotPassword = asyncHandler(async(req, res, next) => {

    const {resetToken} = req.params
    const {newPassword} = req.body

    let hashedToken = crypto
                        .createHash("sha256")
                        .update(resetToken)
                        .digest("hex")


    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: {$gt: Date.now()}
    })

    if(!user){
        throw new ApiError(489, "Token is invalid or expired")
    }

    user.forgotPasswordToken = undefined
    user.forgotPasswordExpiry = undefined
    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
            .status(200)
            .json(
                new ApiResponse(200, {}, "Password reset successful")
            )

})


// Change password when user is logged in
const changeCurrentPassword = asyncHandler(async(req, res, next) => {

    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword;

    await user.save({validateBeforeSave: false});

    return res
            .status(200)
            .json(
                new ApiResponse(200, {}, "Password changed successfully")
            )

})


export {registerUser, login, logoutUser, getCurrentUser, verifyEmail, resendEmailVerification, refreshRefreshToken, forgotPasswordRequest, resetForgotPassword, changeCurrentPassword}

