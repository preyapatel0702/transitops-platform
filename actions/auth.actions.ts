"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import { registerSchema, RegisterInput } from "@/validations/auth.schema";

export async function createUser(input: RegisterInput) {
  return runAction(async () => {
    await requireRole(["ADMIN"]);
    const data = registerSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BusinessRuleError("A user with this email already exists");

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { ...data, password: hashedPassword },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return user;
  });
}
