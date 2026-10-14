import React from 'react';
import { 
  Check, FileUp, Sparkles, Award, BookOpen, Clock, 
  ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, CreditCard
} from 'lucide-react';

interface JourneyStepperProps {
  currentStatus: string;
  hasSubmission?: boolean;
  plagiarismChecked?: boolean;
  isEligible?: boolean;
  isPaid?: boolean;
  isPublished?: boolean;
  submissionDeadline?: string;
  onActionClick?: () => void;
}

interface Milestone {
  id: number;
  label: string;
  shortDesc: string;
  icon: React.ElementType;
}

const MILESTONES: Milestone[] = [
  { id: 1, label: 'Registration', shortDesc: 'Confirmed', icon: CheckCircle2 },
  { id: 2, label: 'Story Upload', shortDesc: 'DOCX or PDF', icon: FileUp },
  { id: 3, label: 'Editorial Review', shortDesc: 'Expert Evaluation', icon: ShieldCheck },
  { id: 4, label: 'Eligibility & Fee', shortDesc: 'Decision & Payment', icon: Award },
  { id: 5, label: 'Publication', shortDesc: 'Official Anthology', icon: BookOpen },
];

export const LeadJourneyStepper: React.FC<JourneyStepperProps> = ({
  currentStatus,
  hasSubmission = false,
  plagiarismChecked = false,
  isEligible = false,
  isPaid = false,
  isPublished = false,
  submissionDeadline,
  onActionClick
}) => {
  const normStatus = (currentStatus || '').toUpperCase();

  // Determine current active milestone (1 to 5)
  // Stage 1: Registration (Always completed for an existing lead)
  // Stage 2: Story Upload
  // Stage 3: Editorial Review
  // Stage 4: Eligibility & Fee
  // Stage 5: Anthology Publication
  const isSubmitted = hasSubmission || [
    'STORY_SUBMITTED', 'UNDER_REVIEW', 'ELIGIBLE', 'NOT_ELIGIBLE', 
    'PAYMENT_PENDING', 'PAID', 'COMPLETED'
  ].includes(normStatus);

  const isReviewDone = [
    'ELIGIBLE', 'NOT_ELIGIBLE', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'
  ].includes(normStatus);

  const isUnderReview = isSubmitted && !isReviewDone;

  const isPaymentPending = normStatus === 'PAYMENT_PENDING' || (normStatus === 'ELIGIBLE' && !isPaid);

  const isPaidOrCompleted = isPaid || ['PAID', 'COMPLETED'].includes(normStatus);

  // Active step calculation
  let activeStep = 2; // Default: waiting for story submission
  if (!isSubmitted) {
    activeStep = 2;
  } else if (isUnderReview) {
    activeStep = 3;
  } else if (isPaymentPending || normStatus === 'NOT_ELIGIBLE') {
    activeStep = 4;
  } else if (isPaidOrCompleted && !isPublished) {
    activeStep = 5;
  } else if (isPublished) {
    activeStep = 5;
  }

  // Get status metadata for active banner
  const getBannerData = () => {
    if (!isSubmitted) {
      return {
        tone: 'action',
        title: 'Next Step: Upload Story Document',
        description: 'Your registration is confirmed. Please upload your child’s story (.DOCX or .PDF) to enter the editorial review queue.',
        badge: 'Action Required',
        buttonText: 'Submit Story Now',
        icon: FileUp,
      };
    }
    if (isUnderReview) {
      return {
        tone: 'info',
        title: 'Story Under Editorial Review',
        description: 'Story document received safely. Our human editorial panel is reading and evaluating the story for originality and style.',
        badge: 'In Review Queue',
        buttonText: null,
        icon: Clock,
      };
    }
    if (normStatus === 'NOT_ELIGIBLE') {
      return {
        tone: 'neutral',
        title: 'Editorial Review Completed',
        description: 'The editorial review has concluded and detailed constructive feedback is available below to guide the young author.',
        badge: 'Feedback Available',
        buttonText: null,
        icon: Award,
      };
    }
    if (isPaymentPending) {
      return {
        tone: 'payment',
        title: 'Story Approved! Publication Fee Due',
        description: 'Congratulations! The story was approved for the anthology. Complete the publication fee to proceed to typesetting.',
        badge: 'Payment Due',
        buttonText: 'Pay Publication Fee',
        icon: CreditCard,
      };
    }
    if (isPaidOrCompleted && !isPublished) {
      return {
        tone: 'success',
        title: 'Publication & Typesetting in Progress',
        description: 'Payment verified! Our editorial typesetting, proofreading, and anthology book layout are currently underway.',
        badge: 'Typesetting',
        buttonText: null,
        icon: Sparkles,
      };
    }
    return {
      tone: 'published',
      title: 'Story Published in Official Anthology!',
      description: 'The story has been published in the official Writathon anthology. You can view the live link below.',
      badge: 'Live Published',
      buttonText: null,
      icon: BookOpen,
    };
  };

  const banner = getBannerData();
  const BannerIcon = banner.icon;

  // Calculate progress bar fill percentage
  // 1: 0%, 2: 25%, 3: 50%, 4: 75%, 5: 100%
  const getProgressPercentage = () => {
    if (isPublished) return 100;
    if (activeStep === 2) return isSubmitted ? 35 : 15;
    if (activeStep === 3) return 50;
    if (activeStep === 4) return isPaidOrCompleted ? 85 : 70;
    if (activeStep === 5) return 90;
    return 15;
  };

  return (
    <div className="w-full bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-app-border space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
            Author Journey Pipeline
          </span>
          <h2 className="text-xl font-heading font-extrabold text-text-dark">
            Participation Milestones
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Current Stage:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-soft text-primary border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Stage {activeStep} of 5: {MILESTONES[activeStep - 1].label}
          </span>
        </div>
      </div>

      {/* 5-Step Progress Track */}
      <div className="relative pt-2 pb-1">
        {/* Track Line Background */}
        <div className="absolute top-7 left-6 right-6 h-1 bg-gray-100 rounded-full hidden sm:block" />
        
        {/* Active Progress Fill */}
        <div 
          className="absolute top-7 left-6 h-1 bg-brand-gradient rounded-full transition-all duration-700 hidden sm:block"
          style={{ width: `calc(${getProgressPercentage()}% - 24px)` }}
        />

        {/* 5 Steps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
          {MILESTONES.map((step) => {
            const isCompleted = step.id < activeStep || (step.id === 5 && isPublished);
            const isCurrent = step.id === activeStep && !isPublished;
            const StepIcon = step.icon;

            return (
              <div 
                key={step.id} 
                className={`flex flex-col items-center text-center transition-transform ${
                  isCurrent ? 'scale-105' : ''
                }`}
              >
                {/* Circle Indicator */}
                <div 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-brand-gradient text-white shadow-md shadow-purple-500/20' 
                      : isCurrent 
                        ? 'bg-white border-2 border-primary text-primary ring-4 ring-primary-soft shadow-sm'
                        : 'bg-gray-50 border border-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>

                {/* Text Labels */}
                <div className="mt-2.5">
                  <p className={`text-xs font-heading font-bold ${
                    isCompleted 
                      ? 'text-primary' 
                      : isCurrent 
                        ? 'text-text-dark font-extrabold' 
                        : 'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5 hidden sm:block">
                    {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : step.shortDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Human-Friendly Action Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        banner.tone === 'action'
          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
          : banner.tone === 'payment'
            ? 'bg-purple-50/70 border-purple-200 text-purple-950'
            : banner.tone === 'success' || banner.tone === 'published'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-blue-50/70 border-blue-200 text-blue-950'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              banner.tone === 'action'
                ? 'bg-amber-100 text-amber-700'
                : banner.tone === 'payment'
                  ? 'bg-purple-100 text-purple-700'
                  : banner.tone === 'success' || banner.tone === 'published'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
            }`}>
              <BannerIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                  {banner.badge}
                </span>
                <h3 className="font-heading font-bold text-sm text-text-dark">
                  {banner.title}
                </h3>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-2xl">
                {banner.description}
              </p>
            </div>
          </div>

          {banner.buttonText && onActionClick && (
            <button
              onClick={onActionClick}
              className="btn-primary text-xs py-2.5 px-5 shrink-0 self-start sm:self-auto shadow-sm"
            >
              <span>{banner.buttonText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
