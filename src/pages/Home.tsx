import { Hero } from '../home/Hero';
import { AdvisorIntro, ContactSection, Features, HowItWorks } from '../home/HomeSections';

export default function Home() {
  return (
    <>
      <Hero />
      <AdvisorIntro />
      <Features />
      <HowItWorks />
      <ContactSection />
    </>
  );
}
