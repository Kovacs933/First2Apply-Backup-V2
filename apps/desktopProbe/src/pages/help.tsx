import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

export function HelpPage() {
  return (
    <DefaultLayout className="flex flex-col space-y-6 p-6 md:p-10">
      <h1 className="w-fit text-2xl font-medium tracking-wide">FAQs</h1>

      <Accordion type="single" collapsible className="w-full rounded-lg border px-6">
        <AccordionItem value="item-2" className="py-2">
          <AccordionTrigger className="text-lg font-normal hover:text-primary hover:no-underline">
            Can the app apply to jobs for me?
          </AccordionTrigger>
          <AccordionContent className="text-base font-light">
            It does most of the work. Save the jobs you like, then open the <b>Saved</b> tab and click{' '}
            <b>Apply to saved jobs</b>. Foundation opens each application in turn and fills in your name, email, phone
            and location from the <b>CV Builder</b>. You check the form, attach your CV and press Submit yourself, so
            nothing is ever sent without you seeing it. Then click <b>Applied, next job</b> to move on.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3" className="py-2">
          <AccordionTrigger className="text-lg font-normal hover:text-primary hover:no-underline">
            Can it filter out jobs that I'm not interested in?
          </AccordionTrigger>
          <AccordionContent className="text-base font-light">
            Yes. On the <b>AI Filters</b> page, write in plain English what you don't want (for example "Hide jobs
            paying less than £30,000"), and add any companies you never want to see. Foundation's AI checks every new
            job against your rules and moves the ones that don't fit to the Filtered out tab.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4" className="py-2">
          <AccordionTrigger className="text-lg font-normal hover:text-primary hover:no-underline">
            What happens if I close my computer?
          </AccordionTrigger>
          <AccordionContent className="text-base font-light">
            If you close your computer, the app will temporarily pause its job search operations. It will automatically
            reactivate and continue searching for new jobs once you power on your computer again. For uninterrupted
            service, we've included a setting in the app that can keep your computer awake while the app is in use.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-5" className="py-2">
          <AccordionTrigger className="text-lg font-normal hover:text-primary hover:no-underline">
            How will I see new job alerts when I'm not in front of my computer?
          </AccordionTrigger>
          <AccordionContent className="text-base font-light">
            The app is designed to send you email notifications for new found jobs. This way you can apply to jobs even
            when you are not in front of your computer. You can disable the email notifications in the app settings.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-6" className="border-b-0 py-2">
          <AccordionTrigger className="text-lg font-normal hover:text-primary hover:no-underline">
            Can I navigate the app using my keyboard?
          </AccordionTrigger>
          <AccordionContent className="text-base font-light">
            Yes! The app is designed to be fully accessible using your keyboard.
            <ul className="mt-1 pl-6 text-sm" style={{ listStyleType: 'initial' }}>
              <li>
                <b>Left/Right arrows</b>: switch between job tabs
              </li>
              <li>
                <b>Up/Down arrows</b>: navigate through job listings
              </li>
              <li>
                <b>Cmd+a / Ctrl+a</b>: save selected job for later
              </li>
              <li>
                <b>Cmd+d / Ctrl+d</b>: delete selected job
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-center justify-end gap-4">
        <p className="text-base">
          Didn't find what you need? You can send us an email at{' '}
          <a href="mailto:edwardhoffman951@gmail.com" className="text-primary underline">
            edwardhoffman951@gmail.com
          </a>
        </p>
      </div>
    </DefaultLayout>
  );
}
