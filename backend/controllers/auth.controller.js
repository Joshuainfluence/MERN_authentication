import { User } from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { generateTokenAndSetCookie } from '../utils/generateTokenAndSetCookie.js';
import { sendPasswordResetEmail, sendResetSuccessEmail, sendVerificationEmail, sendWelcomeEmail } from "../mailtrap/emails.js";
// import bcrypt from "bcryptjs/dist/bcrypt.js";



export const signup = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        if (!email || !password || !name) {
            throw new Error("All fields are required");

        }
        const userAlreadyExists = await User.findOne({ email });
        console.log("userAlreadyExist", userAlreadyExists);
        if (userAlreadyExists) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({
            email,
            password: hashedPassword,
            name,
            verificationToken,
            verificationTokenExpiredAt: Date.now() + 24 * 60 * 60 * 1000 //24hrs
        })

        await user.save();

        generateTokenAndSetCookie(res, user._id);

        await sendVerificationEmail(user.email, verificationToken);

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                ...user._doc,
                password: undefined,
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

export const verifyEmail = async (req, res) => {
    const { code } = req.body;
    try {
        const user = await User.findOne({
            verificationToken: code,
            verificationTokenExpiredAt: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).json({ success: false, message: "invalid or expired verification code" })
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiredAt = undefined;
        await user.save();

        await sendWelcomeEmail(user.email, user.name);

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            user: {
                ...user._doc,
                password: undefined,
            },
        });
    } catch (error) {
        console.log("error in verfifyEmail", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid Credentials" });
        }
        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: "Invalid Credentials" });
        }

        generateTokenAndSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();
        
        res.status(200).json({
            success: true,
            message: "Logged in Successfully",
            user:{
                ...user._doc,
                password: undefined,
            }
        })
    } catch (error) {
        console.log("Error in login", error);
        res.status(400).json({success: false, message: error.message})
    }
}
export const logout = async (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ success: true, message: "Logged out successfully" });

}

export const forgotPassword = async (req, res) =>{
    const {email} = req.body;
    try {
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({success: false, message: "User does not exist"});
        }
        // generate reset token
        const resetToken = crypto.randomBytes(20).toString("hex");
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; //1hr
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiredAt = resetTokenExpiresAt;


        await user.save(); //for updating database

        // send email
        await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);
        res.status(200).json({success: true, message: "Password reset link sent to your email"})
    } catch (error) {
        console.log("Error in forgotPassword", error);
        res.status(400).json({success:false, message: error.message});
    }
}

export const resetPassword = async (req, res) => {
    try {
        const {token} = req.params;
        const {password} = req.body;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiredAt: {$gt: Date.now()},
        });

        if(!user){
            res.status(400).json({success: false, message: "invalid or expired reset token"});
        }
        // update password
        const hashedPassword = await bcryptjs.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiredAt = undefined;

        await user.save();

        await sendResetSuccessEmail(user.email);
        res.status(200).json({success: true, message: "Password reset successful"});
    } catch (error) {
        console.log("Error in resetPassword", error);
        res.status(400).json({success: false, message: error.message});
    }
}

export const checkAuth = async (req, res) => {
    try {
        const user = await user.findById(req.userId)
        if(!user){
            return res.status(400).json({success:false, message: "User not found"})
        } 
        res.status(200).json({
            success:true,
            user: {
                ...user._doc,
                password: undefined
            }
        });
    } catch (error) {
        console.log("Error in checkAuth", error);
        res.status(400).json({success:false, message: error.message});
    }
}