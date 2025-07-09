const { Router } = require('express');

const expenseRouter = Router();

const mongoose = require('mongoose');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { expenseModel } = require('../db');
const { userModel } = require('../db');

const { auth } = require('./auth');

expenseRouter.post('/add', auth, async (req, res) => {
    const requireBody = z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        amount: z.number().positive(),
        date: z.coerce.date(),
        type: z.enum(['income', 'expense'])
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.status(400).json({
            message: "Invalid data",
            error: parsedata.error
        });
    }

    const { title, description, amount, date, type } = req.body;

    try {
        const expense = await expenseModel.create({
            title,
            description,
            amount,
            date,
            type,
            userId: req.user._id
        });
        res.status(201).json({ 
            message: "Expense added successfully",
            expense 
        });
    } catch (error) {
        res.status(500).json({ message: "Error adding expense", error });
    }
});

// Add multiple expenses at once
expenseRouter.post('/add/bulk', auth, async (req, res) => {
    const requireBody = z.object({
        expenses: z.array(z.object({
            title: z.string().min(1),
            description: z.string().min(1),
            amount: z.number().positive(),
            date: z.coerce.date(),
            type: z.enum(['income', 'expense'])
        })).min(1).max(100)
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.status(400).json({
            message: "Invalid data",
            error: parsedata.error
        });
    }

    const { expenses } = req.body;

    try {
        const expensesWithUserId = expenses.map(expense => ({
            ...expense,
            userId: req.user._id
        }));

        const createdExpenses = await expenseModel.insertMany(expensesWithUserId);
        res.status(201).json({ 
            message: `${createdExpenses.length} expenses added successfully`,
            expenses: createdExpenses
        });
    } catch (error) {
        res.status(500).json({ message: "Error adding expenses", error });
    }
});

// Get recent expenses (last 30 days)
expenseRouter.get('/recent', auth, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const expenses = await expenseModel.find({ 
            userId: req.user._id,
            date: { $gte: thirtyDaysAgo }
        }).sort({ date: -1 });

        res.status(200).json({ expenses });
    } catch (error) {
        res.status(500).json({ message: "Error fetching recent expenses", error });
    }
});

// Get expenses by date range
expenseRouter.get('/date-range', auth, async (req, res) => {
    const querySchema = z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
    });

    const parseQuery = querySchema.safeParse(req.query);

    if (!parseQuery.success) {
        return res.status(400).json({
            message: "Invalid date range",
            error: parseQuery.error
        });
    }

    const { startDate, endDate } = parseQuery.data;

    try {
        const expenses = await expenseModel.find({
            userId: req.user._id,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 });

        res.status(200).json({ expenses });
    } catch (error) {
        res.status(500).json({ message: "Error fetching expenses by date range", error });
    }
});


expenseRouter.get('/top', auth, async (req, res) => {
    const querySchema = z.object({
        limit: z.coerce.number().positive().max(50).default(10),
        type: z.enum(['income', 'expense']).optional()
    });

    const parseQuery = querySchema.safeParse(req.query);

    if (!parseQuery.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            error: parseQuery.error
        });
    }

    const { limit, type } = parseQuery.data;

    try {
        const filter = { userId: req.user._id };
        if (type) filter.type = type;

        const expenses = await expenseModel.find(filter)
            .sort({ amount: -1 })
            .limit(limit);

        res.status(200).json({ expenses });
    } catch (error) {
        res.status(500).json({ message: "Error fetching top expenses", error });
    }
});

// Get all expenses for user
expenseRouter.get('/all', auth, async (req, res) => {
    try {
        const expenses = await expenseModel.find({ userId: req.user._id })
            .sort({ date: -1 });
        res.status(200).json({ expenses });
    } catch (error) {
        res.status(500).json({ message: "Error fetching expenses", error });
    }
});

// Duplicate an expense
expenseRouter.post('/duplicate/:id', auth, async (req, res) => {
    try {
        const originalExpense = await expenseModel.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!originalExpense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        const duplicateExpense = await expenseModel.create({
            title: originalExpense.title + " (Copy)",
            description: originalExpense.description,
            amount: originalExpense.amount,
            date: new Date(),
            type: originalExpense.type,
            userId: req.user._id
        });

        res.status(201).json({
            message: "Expense duplicated successfully",
            expense: duplicateExpense
        });
    } catch (error) {
        res.status(500).json({ message: "Error duplicating expense", error });
    }
});

// Delete multiple expenses
expenseRouter.delete('/bulk', auth, async (req, res) => {
    const requireBody = z.object({
        expenseIds: z.array(z.string()).min(1).max(100)
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.status(400).json({
            message: "Invalid data",
            error: parsedata.error
        });
    }

    const { expenseIds } = req.body;

    try {
        const result = await expenseModel.deleteMany({
            _id: { $in: expenseIds },
            userId: req.user._id
        });

        res.status(200).json({
            message: `${result.deletedCount} expenses deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ message: "Error deleting expenses", error });
    }
});

// Get single expense by ID
expenseRouter.get('/:id', auth, async (req, res) => {
    try {
        const expense = await expenseModel.findOne({ 
            _id: req.params.id, 
            userId: req.user._id 
        });

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ expense });
    } catch (error) {
        res.status(500).json({ message: "Error fetching expense", error });
    }
});

// Update expense
expenseRouter.put('/:id', auth, async (req, res) => {
    const requireBody = z.object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        date: z.coerce.date().optional(),
        type: z.enum(['income', 'expense']).optional()
    });

    const parsedata = requireBody.safeParse(req.body);

    if (!parsedata.success) {
        return res.status(400).json({
            message: "Invalid data",
            error: parsedata.error
        });
    }

    try {
        const expense = await expenseModel.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ message: "Expense updated successfully", expense });
    } catch (error) {
        res.status(500).json({ message: "Error updating expense", error });
    }
});

// Delete expense
expenseRouter.delete('/:id', auth, async (req, res) => {
    try {
        const expense = await expenseModel.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.user._id 
        });

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting expense", error });
    }
});

// Get expense summary/statistics
expenseRouter.get('/stats/summary', auth, async (req, res) => {
    const querySchema = z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional()
    });

    const parseQuery = querySchema.safeParse(req.query);

    if (!parseQuery.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            error: parseQuery.error
        });
    }

    const { startDate, endDate } = parseQuery.data;

    try {
        const filter = { userId: req.user._id };
        
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = startDate;
            if (endDate) filter.date.$lte = endDate;
        }

        const summary = await expenseModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    average: { $avg: '$amount' }
                }
            }
        ]);

        const totalIncome = summary.find(s => s._id === 'income')?.total || 0;
        const totalExpenses = summary.find(s => s._id === 'expense')?.total || 0;
        const balance = totalIncome - totalExpenses;

        res.status(200).json({
            summary: {
                totalIncome,
                totalExpenses,
                balance,
                breakdown: summary
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching summary", error });
    }
});

// Get expense categories with counts
expenseRouter.get('/stats/categories', auth, async (req, res) => {
    try {
        const categories = await expenseModel.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    avgAmount: { $avg: '$amount' },
                    maxAmount: { $max: '$amount' },
                    minAmount: { $min: '$amount' }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        res.status(200).json({ categories });
    } catch (error) {
        res.status(500).json({ message: "Error fetching category stats", error });
    }
});

module.exports = {
    expenseRouter
};
