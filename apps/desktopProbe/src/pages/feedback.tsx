import { Item } from '@radix-ui/react-radio-group';
import { useEffect, useState } from 'react';

import { Review } from '@first2apply/core';
import { useForm } from '@first2apply/ui';
import { Card, CardContent, CardHeader } from '@first2apply/ui';
import { RadioGroup } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Skeleton } from '@first2apply/ui';
import { Textarea } from '@first2apply/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Icons } from '../components/icons';
import { useError } from '../hooks/error';
import { createReview, getAppInfo, getOS, getUserReview, openExternalUrl, updateReview } from '../lib/electronMainSdk';
import { DefaultLayout } from './defaultLayout';

// Foundation isn't on the Microsoft Store yet (the old id was First 2 Apply's listing).
// Set it to 'ms-windows-store://pdp/?productid=<your id>' to show the "leave a review" prompt.
const MICROSOFT_APP_URL = '';

// where feedback can also be emailed (it's always saved to Foundation's database first)
const FEEDBACK_EMAIL = 'edwardhoffman951@gmail.com';

// what the feedback is about, picked with one click
const StarIcon = ({ filled = false }) => (
  <svg
    className={`h-6 w-6 ${filled ? 'text-primary' : 'text-border'} transition-colors`}
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path d="M12 .587l3.668 7.431 8.332 1.21-6.001 5.852 1.416 8.254L12 18.896l-7.415 3.898 1.416-8.254-6.001-5.852 8.332-1.21L12 .587z" />
  </svg>
);

const schema = z.object({
  title: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  rating: z.number().min(1, { message: 'Rate from 1 to 5 stars' }).max(5),
  jobBoard: z.string().max(300).optional(),
  improve: z.string().max(300).optional(),
});

type FormValues = z.infer<typeof schema>;

export function FeedbackPage() {
  const { handleError } = useError();

  const [isLoading, setIsLoading] = useState(true);
  const [userOS, setUserOS] = useState<NodeJS.Platform | ''>('');
  const [appInfo, setAppInfo] = useState<{ version: string; os: string } | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [hoveredValue, setHoveredValue] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // what was just sent, for the thank-you screen and the optional email
  const [sent, setSent] = useState<{ subject: string; body: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      rating: 5,
    },
    mode: 'onChange',
  });

  /**
   * Load the user's earlier feedback (their rating is kept), the OS and the app version.
   */
  useEffect(() => {
    const load = async () => {
      try {
        const existingReview = await getUserReview();
        if (existingReview) form.setValue('rating', existingReview.rating);
        setExistingReview(existingReview);

        setUserOS(await getOS());
        setAppInfo(await getAppInfo().catch((): null => null));
        setIsLoading(false);
      } catch (error) {
        handleError({ error });
      }
    };

    load();
  }, []);

  const { setValue, watch } = form;
  const rating = watch('rating');
  const jobBoardLabel = 'Which job boards would you like to see in Foundation?';

  /**
   * Save the feedback to Foundation's database (no email app needed), then show the thank-you screen.
   */
  const onSubmit = async (values: FormValues) => {
    try {
      const { rating, jobBoard, improve } = values;
      const title = (values.title?.trim() || 'Feedback').slice(0, 80);
      const description = [
        values.description?.trim(),
        jobBoard?.trim() ? `Job boards I'd like to see: ${jobBoard.trim()}` : '',
        improve?.trim() ? `What I'd like improved: ${improve.trim()}` : '',
        appInfo ? `Foundation ${appInfo.version} on ${appInfo.os}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      setIsSubmitting(true);
      const updatedReview = existingReview
        ? await updateReview({ id: existingReview.id, title, description, rating })
        : await createReview({ title, description, rating });
      setExistingReview(updatedReview);
      setSent({ subject: `Foundation feedback (${rating}/5): ${title}`, body: `${description}\n\nRating: ${rating}/5` });
      form.reset({ title: '', description: '', jobBoard: '', improve: '', rating });
    } catch (error) {
      handleError({ error });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEmailToo = () => {
    if (!sent) return;
    openExternalUrl(
      `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(sent.subject)}&body=${encodeURIComponent(sent.body)}`,
    );
  };

  if (isLoading) {
    return (
      <DefaultLayout className="space-y-3 p-6 md:p-10">
        <Skeleton className="mb-4 h-4 w-full" />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="space-y-6 p-6 md:p-10">
      <h1 className="text-2xl font-medium tracking-wide">Feedback</h1>

      {sent ? (
        // thank-you screen
        <Card className="rounded-lg">
          <CardHeader>
            <h2 className="text-xl font-medium">Thank you! Your feedback has been sent.</h2>
            <p className="text-sm text-muted-foreground">
              It's saved straight to the Foundation team, so there's nothing else you need to do.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => setSent(null)}>Send more feedback</Button>
            <Button variant="outline" onClick={onEmailToo}>
              Email it to us too
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg">
          <CardHeader>
            <h2 className="text-xl font-medium">Help us make Foundation better</h2>
            <p className="text-balance text-sm text-muted-foreground">
              Let us know what works, what doesn't or any ideas you might have that would make the app better suited
              to your job hunting needs.
            </p>
            {userOS === 'win32' && MICROSOFT_APP_URL && (
              <p className="my-2 text-balance text-sm text-muted-foreground">
                If you're enjoying Foundation, please consider leaving a review on the{' '}
                <a
                  className="hover:text-primary-dark text-primary underline hover:cursor-pointer hover:no-underline"
                  onClick={(e) => {
                    e.preventDefault();
                    openExternalUrl(MICROSOFT_APP_URL);
                  }}
                >
                  Microsoft Store
                </a>
                .
              </p>
            )}
          </CardHeader>

          <CardContent className="py-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="rating"
                  render={() => (
                    <FormItem className="w-full">
                      <FormLabel>How would you rate Foundation?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={String(rating)}
                          onValueChange={(value) => setValue('rating', Number(value))}
                          className="flex items-center"
                        >
                          {Array.from({ length: 5 }, (_, index) => {
                            const value = index + 1;
                            return (
                              <Item
                                key={value}
                                value={String(value)}
                                onMouseEnter={() => setHoveredValue(value)}
                                onMouseLeave={() => setHoveredValue(0)}
                              >
                                <label className="cursor-pointer">
                                  <StarIcon filled={value <= (hoveredValue || rating)} />
                                </label>
                              </Item>
                            );
                          })}
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input id="title" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Tell us more</FormLabel>
                      <FormControl>
                        <Textarea id="description" className="resize-none" rows={6} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobBoard"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>{jobBoardLabel}</FormLabel>
                      <FormControl>
                        {/* half the height of the description box */}
                        <Textarea id="jobBoard" className="resize-none" rows={3} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="improve"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>What would you like improved?</FormLabel>
                      <FormControl>
                        <Textarea id="improve" className="resize-none" rows={3} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {appInfo && (
                  <p className="text-xs text-muted-foreground">
                    Your app version (Foundation {appInfo.version}, {appInfo.os}) is sent with your feedback, to
                    help us fix problems.
                  </p>
                )}

                <Button type="submit" disabled={isSubmitting} size="lg" className="text-base">
                  {isSubmitting ? (
                    <>
                      <Icons.spinner2 className="h-4 w-4 animate-spin" />
                      Sending ...
                    </>
                  ) : (
                    'Send feedback'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </DefaultLayout>
  );
}
