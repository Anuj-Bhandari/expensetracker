const {Router} = require('express');

const userRouter = Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {z} = require('zod');

const {auth} = require('./auth');

const secretkey = process.env.SECRET_KEY;

const {userModel} = require('../db');
const {expenseModel} = require('../db');

userRouter.post('/signup', async (req, res) => {
 
    const requireBody = z.object({
        email: z.string().email().min(5),
        password: z.string().min(2),
        name: z.string().min(3),
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.json({
            message: "Incorrect data",
            error: parsedata.error
        });
    }

    const {email, password, name} = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);  // 10 is the salt

    try {
        await userModel.create({
            email,
            password: hashedPassword,
            name
        });
    } catch (error) {
        return res.status(400).json({
            message: "You are already signed up!",
        });
    }

    res.status(201).json({
        message: "User signed up"
    });
})

userRouter.post('/signin', async (req, res) => {

    const requireBody = z.object({
        email: z.string().email().min(5),
        password: z.string().min(3)
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.json({
            message: "Incorrect data",
            error: parsedata.error
        });
    }

    const {email, password} = req.body;

    const user = await userModel.findOne({email});

    if (!user) {
        return res.status(400).json({
            message: "User not found"
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Invalid password"
        });
    }

    const token = jwt.sign({id: user._id}, secretkey);

    res.status(200).json({
        message: "User signed in",
        token: token 
    });
})


module.exports = {
    userRouter
}
