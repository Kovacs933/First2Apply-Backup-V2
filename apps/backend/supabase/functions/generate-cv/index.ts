import { GenerateCvParams, getExceptionMessage, throwError } from '@first2apply/core';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { CORS_HEADERS } from '../_shared/cors.ts';
import { getEdgeFunctionContext } from '../_shared/edgeFunctions.ts';
import { parseEnv } from '../_shared/env.ts';
import { createLoggerWithMeta } from '../_shared/logger.ts';
import { buildOpenAiClient, logAiUsage, OPENROUTER_ROUTING } from '../_shared/openAI.ts';

const GeneratedCvFormat = z.object({
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      employer: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(z.object({ qualification: z.string(), place: z.string(), dates: z.string() })),
});

const MAX_CHARS = 4000;
const clip = (value: string | undefined, max = MAX_CHARS) => (value ?? '').slice(0, max);

const SYSTEM_PROMPT = `You write UK CVs. You tailor a candidate's CV to the job role they want, using what employers hiring for that role ask for.

Strict rules:
- NEVER invent jobs, employers, dates, qualifications, achievements, numbers or skills. Only use facts from the candidate's details and existing CV.
- Reword and reorder what the candidate gave you so the most relevant experience and skills for the target role come first, using the employers' wording where it truthfully fits.
- Only list a skill if the candidate's details or CV show they have it.
- summary: 3-4 sentences in the first person without "I" (UK CV style), aimed at the target role.
- experience: keep every job the candidate listed, most recent first, with 2-5 short bullets each starting with an action verb. Keep their dates exactly as written (use "" if none).
- education: keep exactly what the candidate listed (use "" for missing dates).
- skills: up to 12, most relevant to the target role first.
- Use UK English spelling.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const logger = createLoggerWithMeta({ function: 'generate-cv' });
  try {
    const { user, supabaseAdminClient } = await getEdgeFunctionContext({ logger, req, checkAuthorization: true });
    const body: GenerateCvParams = await req.json();
    if (!body.targetRole?.trim()) throw new Error('Please enter the job role you want.');
    if (!body.profile?.fullName?.trim()) throw new Error('Please enter your name.');

    if (!parseEnv().openRouterConfig.apiKey.startsWith('sk-or-')) {
      throw new Error(
        "AI writing isn't set up on Foundation's server yet (no OpenRouter key). Choose 'Use a template (no AI)' for now.",
      );
    }

    const { openAi, llmConfig } = buildOpenAiClient({ modelName: 'deepseek/deepseek-v4-flash' });
    const userPrompt = `Target role: ${body.targetRole}

What employers hiring for this role ask for (from ${body.jobsAnalysed} job adverts):
${body.employerSkills.map((s) => `- ${s.skill} (in ${s.jobCount} adverts)`).join('\n') || '- (no adverts found yet)'}

Example adverts:
${body.sampleJobs
  .slice(0, 4)
  .map((job) => `## ${job.title} at ${job.companyName}\n${clip(job.description, 1500)}`)
  .join('\n\n') || '(none)'}

The candidate's details:
${clip(JSON.stringify(body.profile, null, 1), 8000)}

The candidate's existing CV (may be empty):
${clip(body.existingCv, 8000)}`;

    const response = await openAi.chat.completions.create({
      model: llmConfig.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 3000,
      response_format: zodResponseFormat(GeneratedCvFormat, 'GeneratedCv'),
      ...OPENROUTER_ROUTING,
    });

    const choice = response.choices[0];
    if (choice.finish_reason !== 'stop') {
      throw new Error(`The AI didn't finish writing the CV (${choice.finish_reason}). Please try again.`);
    }
    const cv = GeneratedCvFormat.parse(JSON.parse(choice.message.content ?? throwError('missing content')));

    await logAiUsage({ logger, supabaseAdminClient, forUserId: user.id, llmConfig, response });

    return new Response(JSON.stringify({ cv }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (error) {
    logger.error(getExceptionMessage(error));
    return new Response(JSON.stringify({ errorMessage: getExceptionMessage(error, true) }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      // functions-js treats non-2xx as a generic error, so errors are returned with 200 (see other functions)
    });
  }
});
