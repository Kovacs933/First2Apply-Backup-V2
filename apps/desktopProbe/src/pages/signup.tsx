import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SignupCard } from '@/components/signupCard';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { getUser, signupWithEmail } from '@/lib/electronMainSdk';
import { useToast } from '@first2apply/ui';

/**
 * Component used to render the signup page.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useSession();
  const { handleError } = useError();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSignupWithEmail = async ({ email, password }: { email: string; password: string }) => {
    try {
      setIsSubmitting(true);
      const user = await signupWithEmail({ email, password });
      // the hosted backend makes new accounts confirm their email first: signing up then gives an account but no
      // session, and treating that as logged in made every page fail (empty job boards, saves refused)
      const signedIn = await getUser();
      if (!signedIn) {
        toast({
          title: 'Check your email',
          description: `We've sent a link to ${email}. Click it to confirm your account, then log in here.`,
          variant: 'success',
        });
        navigate('/login');
        return;
      }
      login(user);
      navigate('/');
    } catch (error) {
      handleError({ error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignupCard onSignupWithEmail={onSignupWithEmail} isSubmitting={isSubmitting} />
    </main>
  );
}
