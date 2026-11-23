import AppError from "./appError.ts";
import {
  assertQuestionEditsAreSafe,
  emptyAdditionalAnswers,
  validateAdditionalQuestions,
} from "./additionalQuestions.ts";
import {
  readRegistrationRequirements,
  registrationRequirementsFromEvent,
  REGISTRATION_REQUIREMENT_KEYS,
} from "./registrationFields.ts";

/** True when a request carries registration-form configuration to save. */
export function hasRegistrationFormUpdate(body: Record<string, unknown>): boolean {
  return (
    body.additionalQuestions !== undefined ||
    REGISTRATION_REQUIREMENT_KEYS.some((key) => body[key] !== undefined)
  );
}

/**
 * Applies registration-form edits under the same row lock used by registration
 * creation. Shared by PUT /:id/registration-form and PATCH /:id so both paths
 * enforce the safe-edit rules and keep each registration's answer keys in sync.
 */
export async function saveRegistrationForm(
  tx: any,
  eventId: string,
  body: Record<string, unknown>
): Promise<any> {
  const locked: any[] = await tx.$queryRaw`
    SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE
  `;
  if (locked.length === 0) throw new AppError("Event not found", 404);

  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: {
      registrations: { select: { id: true, additionalAnswers: true } },
    },
  });
  if (!event) throw new AppError("Event not found", 404);

  const currentQuestions = validateAdditionalQuestions(event.additionalQuestions);
  const nextQuestions = validateAdditionalQuestions(
    body.additionalQuestions ?? event.additionalQuestions
  );
  const requirements = readRegistrationRequirements(
    body,
    registrationRequirementsFromEvent(event)
  );

  if (event.registrations.length > 0) {
    assertQuestionEditsAreSafe(currentQuestions, nextQuestions);
  }

  const eventUpdate = await tx.event.update({
    where: { id: eventId },
    data: { additionalQuestions: nextQuestions, ...requirements },
  });

  if (event.registrations.length > 0) {
    const emptyAnswers = emptyAdditionalAnswers(nextQuestions);
    for (const registration of event.registrations) {
      const previous =
        registration.additionalAnswers &&
        typeof registration.additionalAnswers === "object" &&
        !Array.isArray(registration.additionalAnswers)
          ? registration.additionalAnswers
          : {};
      const answers = Object.fromEntries(
        nextQuestions.map((question) => [
          question.id,
          Object.prototype.hasOwnProperty.call(previous, question.id)
            ? previous[question.id]
            : emptyAnswers[question.id],
        ]),
      );
      await tx.registration.update({
        where: { id: registration.id },
        data: { additionalAnswers: answers },
      });
    }
  }

  return eventUpdate;
}
