import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const partSchema = z.object({
  partNumber: z.string().min(1, "กรุณากรอกรหัสอะไหล่"),
  partName: z.string().min(1, "กรุณากรอกชื่ออะไหล่"),
  description: z.string().optional(),
  categoryId: z.string().nullable().transform(v => v === "" || v === null ? null : v).optional(),
  location: z.string().optional(),
  quantity: z.coerce.number().min(0, "จำนวนต้องเป็น 0 ขึ้นไป"),
  minimumQuantity: z.coerce.number().min(0, "จำนวนขั้นต่ำต้องเป็น 0 ขึ้นไป"),
  unit: z.string().min(1, "กรุณากรอกหน่วย"),
  barcodeValue: z
    .union([z.string().trim(), z.null(), z.literal("")])
    .transform(v => (v === "" || v === null ? null : v))
    .optional(),
});

export type PartInput = z.infer<typeof partSchema>;
export type PartInputRaw = z.input<typeof partSchema>;
export type PartInputOutput = z.output<typeof partSchema>;

export const stockMovementSchema = z.object({
  partId: z.string().min(1),
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().finite().int("จำนวนต้องเป็นจำนวนเต็ม"),
  note: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "STOCK_IN" || data.type === "STOCK_OUT") {
    if (data.quantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "จำนวนต้องมากกว่า 0",
        path: ["quantity"],
      });
    }
  } else if (data.type === "ADJUSTMENT") {
    if (data.quantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "จำนวนใหม่ต้องไม่น้อยกว่า 0",
        path: ["quantity"],
      });
    }
  }
});

export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อหมวดหมู่"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const createUserSchema = z.object({
  username: z.string().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร"),
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  role: z.enum(["ADMIN", "STAFF"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  newPassword: z.string().min(6, "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"),
  confirmPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
