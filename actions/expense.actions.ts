"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_FINANCE, CAN_VIEW_ALL } from "@/utils/rbac";
import { runAction, BusinessRuleError } from "@/utils/api-response";
import {
  createExpenseSchema,
  updateExpenseSchema,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "@/validations/expense.schema";

export async function createExpense(input: CreateExpenseInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FINANCE);
    const data = createExpenseSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new BusinessRuleError("Vehicle not found");

    const expense = await prisma.expense.create({ data });
    revalidatePath("/expenses");
    return expense;
  });
}

export async function getExpenses(filters?: { vehicleId?: string; expenseType?: string }) {
  return runAction(async () => {
    await requireRole(CAN_VIEW_ALL);
    return prisma.expense.findMany({
      where: {
        ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters?.expenseType ? { expenseType: filters.expenseType as any } : {}),
      },
      include: { vehicle: true },
      orderBy: { date: "desc" },
    });
  });
}

export async function updateExpense(input: UpdateExpenseInput) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FINANCE);
    const data = updateExpenseSchema.parse(input);
    const { id, ...rest } = data;

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new BusinessRuleError("Expense not found");

    const updated = await prisma.expense.update({ where: { id }, data: rest });
    revalidatePath("/expenses");
    return updated;
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    await requireRole(CAN_MANAGE_FINANCE);

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new BusinessRuleError("Expense not found");

    await prisma.expense.delete({ where: { id } });
    revalidatePath("/expenses");
    return { id };
  });
}
