import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import type { User, CustomRequest, UserPayload } from "../libs/types.js";

// import database
import { users, students,reset_users, reset_enrollments, enrollments } from "../db/db.js";

import { authenticateToken } from "../middlewares/authenMiddleware.js";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminMiddleware.js";
import { checkRoleStudent } from "../middlewares/checkRoleStudentMiddleware.js";
import { checkAllRole } from "../middlewares/checkAllRoleMiddleware.js";
import { readDataFile, writeDataFile } from "../db/db_transactions.js";

const router = Router();

// GET /api/v2/enrollments
router.get("/", authenticateToken, checkRoleAdmin, async (req: Request, res: Response) => {
  try {
    // return all users
    const students = await readDataFile();
    const info = students.map((s) => ({
        studentsId: s.studentId,
        courses: (s.courses ?? []).map(c => ({ courseId: c }))
    }))
    return res.json({
      success: true,
      message: "Enrollments Information",
      data: info
    })

  } catch(err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// POST /api/v2/enrollments/reset
router.get("/reset", authenticateToken, checkRoleAdmin, async (req: Request, res: Response) => {
  try {
    await writeDataFile(students);
    return res.status(200).json({
      success: true,
      message: "enrollments database has been reset",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// GET /api/v2/enrollments/:studentId
router.get("/:studentId", authenticateToken, checkAllRole, async (req: CustomRequest, res: Response) => {
  try {
    const students = await readDataFile();
    const studentId = req.params.studentId;

    const foundIndex = students.findIndex(
      (std) => std.studentId === studentId
    );

    if (foundIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Student does not exists",
      });
    }

    const payload = req.user;
    const data = students[foundIndex];
    if(payload?.role === "ADMIN") {
        return  res.json({
                    success: true,
                    message: "Student Information",
                    data: {
                        studentId: data?.studentId,
                        firstName: data?.firstName,
                        lastName: data?.lastName,
                        program: data?.program,
                        courses: data?.courses
                    }
                });
    }
    else if(payload?.role === "STUDENT" && payload.studentId === studentId) {
        return  res.json({
                    success: true,
                    message: "Student Information",
                    data: {
                        studentId: data?.studentId,
                        firstName: data?.firstName,
                        lastName: data?.lastName,
                        program: data?.program,
                        courses: data?.courses
                    }
                });
    }
    else {
        return res.status(403).json({
            success: false,
            message: "Forbidden access"
        })
    }
  } catch (err) {
    return res.json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

// POST /api/v2/enrollments/:studentId
router.post("/:studentId", authenticateToken, async (req: CustomRequest, res: Response) => {
    try {
        const studentId = req.params.studentId;
        const payload = req.user;
        if(payload?.role === "STUDENT" && payload?.studentId === studentId) {
            const students = await readDataFile();

            const foundIndex = students.findIndex(
                (std) => std.studentId === studentId
            );
            if (foundIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Student does not exists",
                });
            }

            const courseId = req.body.courseId;

            if (!students[foundIndex]?.courses?.includes(courseId)) { 
                students[foundIndex]?.courses?.push(courseId);
                await writeDataFile(students);

                return res.status(200).json({
                    success: true,
                    message: `Student ${studentId} && Course ${courseId} has been added succesfully`,
                    data: {
                        studentId: studentId,
                        courseId: courseId
                    }
                });
            }
            else {
                return res.status(409).json({
                    success: false,
                    message: "studentId && courseId is already exists",
                });
            }
        }
        else {
            return res.status(403).json({
                    success: false,
                    message: "Forbidden access"
                });
        }
    }
    catch(err) {
        return res.json({
            success: false,
            message: "Something is wrong, please try again",
            error: err,
        });
    }
});

// DELETE /api/v2/enrollments/:studentId
router.delete("/:studentId", authenticateToken, async (req: CustomRequest, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const payload = req.user;
    if(payload?.role === "STUDENT" && payload?.studentId === studentId) {
        const students = await readDataFile();

        const foundIndex = students.findIndex(
            (std) => std.studentId === studentId
        );
        if (foundIndex === -1) {
        return res.status(404).json({
            success: false,
            message: "Student does not exists",
        });
        }

        const courseId = req.body.courseId;

        const courseIndex = students[foundIndex]?.courses?.findIndex((c) => String(c) === courseId);
        if (courseIndex === undefined || courseIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Enrollment does not exists",
            });
        }

        // delete found student from array
        students[foundIndex]?.courses?.splice(courseIndex, 1);
        await writeDataFile(students);

        return  res.status(200).json({
                success: true,
                message: `Student ${studentId} && ${courseId} has been deleted successfully`,
                data: enrollments,
                });
    }
    else {
        return res.status(403).json({
            success: false,
            message: "You are not allowed to modify another student's data"
        })
    }
  } catch (err) {
    return res.json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});


export default router;