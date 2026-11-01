import { useState } from "react";
import { cn } from "cn";
import {
  provisionSTUOrganization,
  checkOrganizationNameDuplicate,
  checkOrganizationEmailDuplicate,
} from "@/features/organizations";
import { notify } from "@/core/notifications/notificationService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Warehouse,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  Radio,
  Sliders,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Volume2,
  Cpu,
  Layers,
} from "lucide-react";

export interface STUOnboardingWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export interface IRegionItem {
  name: string;
}

export interface IDepotItem {
  name: string;
  regionName: string;
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function STUOnboardingWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: STUOnboardingWizardDialogProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingStep, setIsValidatingStep] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Step 1: Customer Details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState("");

  // Step 2: Capabilities & Modules
  const [enablePIS, setEnablePIS] = useState(true);
  const [enablePAS, setEnablePAS] = useState(true);
  const [enableITMS, setEnableITMS] = useState(false);
  const [enableV2Routes, setEnableV2Routes] = useState(true);
  const [enableV1Routes, setEnableV1Routes] = useState(false);

  // Step 3: Administrative Regions
  const [regions, setRegions] = useState<IRegionItem[]>([]);
  const [newRegionName, setNewRegionName] = useState("");

  // Step 4: Depots
  const [depots, setDepots] = useState<IDepotItem[]>([]);
  const [newDepotName, setNewDepotName] = useState("");
  const [newDepotRegion, setNewDepotRegion] = useState("");

  // Step 5: Administrator Account
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Helper to clear errors for a field
  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetForm = () => {
    setCurrentStep(1);
    setErrors({});
    setShowPassword(false);
    setName("");
    setEmail("");
    setPhone("");
    setLogo("");
    setEnablePIS(true);
    setEnablePAS(true);
    setEnableITMS(false);
    setEnableV2Routes(true);
    setEnableV1Routes(false);
    setRegions([]);
    setNewRegionName("");
    setDepots([]);
    setNewDepotName("");
    setNewDepotRegion("");
    setAdminEmail("");
    setAdminPassword("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onOpenChange(false);
  };

  // ----------------------------------------------------
  // Step 3 Handlers (Regions)
  // ----------------------------------------------------
  const handleAddRegion = () => {
    const trimmedName = newRegionName.trim();
    const regionErrors: Record<string, string> = {};

    if (!trimmedName) {
      regionErrors.newRegionName = "Region name is required.";
    } else if (trimmedName.length < 2) {
      regionErrors.newRegionName = "Region name must be at least 2 characters.";
    } else if (
      regions.some((r) => r.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      regionErrors.newRegionName = `Region "${trimmedName}" is already added.`;
    }

    if (Object.keys(regionErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...regionErrors }));
      return;
    }

    clearError("newRegionName");
    clearError("regionsList");

    const newRegion: IRegionItem = {
      name: trimmedName,
    };

    setRegions((prev) => [...prev, newRegion]);
    setNewRegionName("");

    if (!newDepotRegion) {
      setNewDepotRegion(trimmedName);
    }
  };

  const handleRemoveRegion = (regionNameToRemove: string) => {
    const remaining = regions.filter((r) => r.name !== regionNameToRemove);
    setRegions(remaining);
    // Cascade removal of child depots
    setDepots((prev) => prev.filter((d) => d.regionName !== regionNameToRemove));

    if (newDepotRegion === regionNameToRemove) {
      setNewDepotRegion(remaining[0]?.name || "");
    }
    if (remaining.length === 0) {
      setErrors((prev) => ({
        ...prev,
        regionsList: "At least one administrative region is required.",
      }));
    }
  };

  // ----------------------------------------------------
  // Step 4 Handlers (Depots)
  // ----------------------------------------------------
  const handleAddDepot = () => {
    const trimmedDepot = newDepotName.trim();
    const depotErrors: Record<string, string> = {};

    if (!trimmedDepot) {
      depotErrors.newDepotName = "Depot name is required.";
    } else if (trimmedDepot.length < 2) {
      depotErrors.newDepotName = "Depot name must be at least 2 characters.";
    } else if (
      depots.some((d) => d.name.toLowerCase() === trimmedDepot.toLowerCase())
    ) {
      depotErrors.newDepotName = `Depot "${trimmedDepot}" is already in the list.`;
    }

    if (!newDepotRegion) {
      depotErrors.newDepotRegion = "Please select an assigned parent region.";
    }

    if (Object.keys(depotErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...depotErrors }));
      return;
    }

    clearError("newDepotName");
    clearError("newDepotRegion");
    clearError("depotsList");

    const newDepot: IDepotItem = {
      name: trimmedDepot,
      regionName: newDepotRegion,
    };

    setDepots((prev) => [...prev, newDepot]);
    setNewDepotName("");
  };

  const handleRemoveDepot = (depotNameToRemove: string) => {
    const remaining = depots.filter((d) => d.name !== depotNameToRemove);
    setDepots(remaining);
    if (remaining.length === 0) {
      setErrors((prev) => ({
        ...prev,
        depotsList: "At least one operational depot is required.",
      }));
    }
  };

  // ----------------------------------------------------
  // Step Transitions & Validations
  // ----------------------------------------------------
  const handleNext = async () => {
    // Step 1 Validation
    if (currentStep === 1) {
      const step1Errors: Record<string, string> = {};
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedPhone = phone.trim();
      const trimmedLogo = logo.trim();

      if (!trimmedName) {
        step1Errors.name = "Organization name is required.";
      } else if (trimmedName.length < 2 || trimmedName.length > 100) {
        step1Errors.name = "Organization name must be between 2 and 100 characters.";
      } else if (!/^[a-zA-Z0-9\s&.,'_-]+$/.test(trimmedName)) {
        step1Errors.name = "Organization name contains invalid characters.";
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!trimmedEmail) {
        step1Errors.email = "Corporate email is required.";
      } else if (!emailRegex.test(trimmedEmail)) {
        step1Errors.email = "Please enter a valid corporate email address (e.g. contact@agency.gov.in).";
      }

      if (!trimmedPhone) {
        step1Errors.phone = "Corporate contact phone is required.";
      } else if (trimmedPhone.length < 7 || trimmedPhone.length > 16) {
        step1Errors.phone = "Please enter a valid contact phone number (7-16 digits).";
      }

      if (trimmedLogo && !/^https?:\/\/.+/i.test(trimmedLogo)) {
        step1Errors.logo = "Logo URL must start with http:// or https://";
      }

      if (Object.keys(step1Errors).length > 0) {
        setErrors(step1Errors);
        return;
      }

      // Check duplicates in database immediately before leaving Step 1
      try {
        setIsValidatingStep(true);
        const nameDuplicate = await checkOrganizationNameDuplicate(trimmedName);
        if (nameDuplicate) {
          setErrors({ name: `An organization with the name "${trimmedName}" already exists.` });
          return;
        }

        const emailDuplicate = await checkOrganizationEmailDuplicate(trimmedEmail);
        if (emailDuplicate) {
          setErrors({ email: `An organization with the email "${trimmedEmail}" already exists.` });
          return;
        }
      } catch (err: any) {
        console.warn("Duplicate pre-check warning:", err);
      } finally {
        setIsValidatingStep(false);
      }

      setErrors({});
    }

    // Step 2 Validation
    if (currentStep === 2) {
      const step2Errors: Record<string, string> = {};
      if (!enablePIS && !enablePAS && !enableITMS) {
        step2Errors.modules = "At least one intelligent transit module (PIS, PAS, or ITMS) must be enabled.";
      }
      if (enablePIS && !enableV1Routes && !enableV2Routes) {
        step2Errors.routes = "At least one route format engine (V2 or V1) must be enabled when PIS is enabled.";
      }
      if (Object.keys(step2Errors).length > 0) {
        setErrors(step2Errors);
        return;
      }
      setErrors({});
    }

    // Step 3 Validation
    if (currentStep === 3) {
      if (regions.length === 0) {
        setErrors({
          regionsList: "Please add at least one administrative region before continuing.",
        });
        return;
      }
      setErrors({});
    }

    // Step 4 Validation
    if (currentStep === 4) {
      if (depots.length === 0) {
        setErrors({
          depotsList: "Please add at least one depot before continuing.",
        });
        return;
      }
      setErrors({});
    }

    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // ----------------------------------------------------
  // Step 5: Final Submission
  // ----------------------------------------------------
  const handleSubmitProvisioning = async () => {
    const step5Errors: Record<string, string> = {};
    const trimmedAdminEmail = adminEmail.trim();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedAdminEmail) {
      step5Errors.adminEmail = "Administrator login email is required.";
    } else if (!emailRegex.test(trimmedAdminEmail)) {
      step5Errors.adminEmail = "Please enter a valid administrator email address.";
    }

    if (!adminPassword) {
      step5Errors.adminPassword = "Administrator password is required.";
    } else if (adminPassword.length < 8) {
      step5Errors.adminPassword = "Password must be at least 8 characters long.";
    }

    if (Object.keys(step5Errors).length > 0) {
      setErrors(step5Errors);
      return;
    }

    setErrors({});

    try {
      setIsSubmitting(true);
      await provisionSTUOrganization({
        organization: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          logo: logo.trim() || null,
          PIS: enablePIS,
          PAS: enablePAS,
          ITMS: enableITMS,
          v1_routes: enablePIS ? enableV1Routes : false,
          v2_routes: enablePIS ? enableV2Routes : false,
        },
        regions: regions.map((r) => r.name),
        depots: depots.map((d) => ({ name: d.name, regionName: d.regionName })),
        adminUser: {
          email: trimmedAdminEmail,
          password: adminPassword,
        },
      });

      notify.success(
        "Organization Created Successfully",
        `Created "${name.trim()}" with ${regions.length} regions, ${depots.length} depots, and admin credentials.`
      );
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setErrors({ submit: err.message || "Failed to create organization." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: "Organization Details", icon: Building2 },
    { num: 2, title: "Capabilities", icon: Sliders },
    { num: 3, title: "Regions", icon: Compass },
    { num: 4, title: "Bus Depots", icon: Warehouse },
    { num: 5, title: "Admin & Create", icon: KeyRound },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl p-6">
        {/* Dialog Header */}
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Create Organization
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up transit organization, administrative regions, bus depots, and master credentials.
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="grid grid-cols-5 gap-2 pt-4">
            {steps.map((step) => {
              const Icon = step.icon;
              const isPassed = step.num < currentStep;
              const isCurrent = step.num === currentStep;
              return (
                <div
                  key={step.num}
                  className={cn(
                    "flex flex-col items-center gap-1 pb-1.5 border-b-2 text-center transition-all",
                    isCurrent
                      ? "border-primary text-primary font-semibold"
                      : isPassed
                      ? "border-emerald-600 text-emerald-600"
                      : "border-border text-muted-foreground opacity-60"
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    {isPassed ? (
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline text-[11px] font-medium">
                      {step.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* ========================================================================= */}
        {/* Step 1: Customer & Organization Information */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4 py-2">
            {/* Organization Name */}
            <div className="space-y-1">
              <Label htmlFor="stu-name" className="text-xs font-semibold">
                Organization / Agency Name *
              </Label>
              <Input
                id="stu-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder="e.g. Karnataka State Road Transport Corporation (KSRTC)"
                aria-invalid={Boolean(errors.name)}
                autoFocus
              />
              <FieldErrorText message={errors.name} />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stu-email" className="text-xs font-semibold">
                  Corporate Contact Email *
                </Label>
                <Input
                  id="stu-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                  placeholder="contact@agency.gov.in"
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldErrorText message={errors.email} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="stu-phone" className="text-xs font-semibold">
                  Corporate Phone Number *
                </Label>
                <Input
                  id="stu-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearError("phone");
                  }}
                  placeholder="+91 80 2222 1111"
                  aria-invalid={Boolean(errors.phone)}
                />
                <FieldErrorText message={errors.phone} />
              </div>
            </div>

            {/* Optional Logo */}
            <div className="space-y-1">
              <Label htmlFor="stu-logo" className="text-xs font-semibold">
                Agency Logo URL (Optional)
              </Label>
              <Input
                id="stu-logo"
                type="url"
                value={logo}
                onChange={(e) => {
                  setLogo(e.target.value);
                  clearError("logo");
                }}
                placeholder="https://cdn.agency.gov.in/logo.png"
                aria-invalid={Boolean(errors.logo)}
              />
              <FieldErrorText message={errors.logo} />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Step 2: Transit Capabilities & Modules */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2">
            {/* Section 1: Intelligent Transit Modules Header */}
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Intelligent Transit Modules
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable onboard hardware systems, telematics, and announcement technologies.
              </p>
            </div>

            {/* Primary Intelligent Transit Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-0.5">
              {/* Card 1: PIS */}
              <div
                role="checkbox"
                aria-checked={enablePIS}
                tabIndex={0}
                onClick={() => {
                  const nextPIS = !enablePIS;
                  setEnablePIS(nextPIS);
                  if (nextPIS && !enableV1Routes && !enableV2Routes) {
                    setEnableV2Routes(true);
                  }
                  clearError("modules");
                  clearError("routes");
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    const nextPIS = !enablePIS;
                    setEnablePIS(nextPIS);
                    if (nextPIS && !enableV1Routes && !enableV2Routes) {
                      setEnableV2Routes(true);
                    }
                    clearError("modules");
                    clearError("routes");
                  }
                }}
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                  enablePIS
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                    : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Radio className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>PIS Displays</span>
                  </div>
                  <Checkbox
                    checked={enablePIS}
                    tabIndex={-1}
                    className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                  Passenger Information System & destination LED signs
                </p>
              </div>

              {/* Card 2: PAS */}
              <div
                role="checkbox"
                aria-checked={enablePAS}
                tabIndex={0}
                onClick={() => {
                  setEnablePAS(!enablePAS);
                  clearError("modules");
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setEnablePAS(!enablePAS);
                    clearError("modules");
                  }
                }}
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                  enablePAS
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                    : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Volume2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>PAS Audio</span>
                  </div>
                  <Checkbox
                    checked={enablePAS}
                    tabIndex={-1}
                    className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                  Synthesized speech announcements & stop arrival chimes
                </p>
              </div>

              {/* Card 3: ITMS */}
              <div
                role="checkbox"
                aria-checked={enableITMS}
                tabIndex={0}
                onClick={() => {
                  setEnableITMS(!enableITMS);
                  clearError("modules");
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setEnableITMS(!enableITMS);
                    clearError("modules");
                  }
                }}
                className={cn(
                  "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                  enableITMS
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                    : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Cpu className="h-4 w-4 text-cyan-600 shrink-0" />
                    <span>ITMS Telematics</span>
                  </div>
                  <Checkbox
                    checked={enableITMS}
                    tabIndex={-1}
                    className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                  Real-time GPS telemetry & schedule compliance tracking
                </p>
              </div>
            </div>

            {/* Section 2: PIS Features Header & Route Access (shown only if PIS is checked) */}
            {enablePIS && (
              <div className="space-y-3 pt-3 border-t border-border/80 animate-in fade-in-50 duration-200">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground block">
                      PIS Route Display Engines
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      PIS Sub-Features
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select supported route format engines for LED destination boards and in-bus screens.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                  {/* Card: V2 Route Engine */}
                  <div
                    role="checkbox"
                    aria-checked={enableV2Routes}
                    tabIndex={0}
                    onClick={() => {
                      setEnableV2Routes(!enableV2Routes);
                      clearError("routes");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEnableV2Routes(!enableV2Routes);
                        clearError("routes");
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      enableV2Routes
                        ? "border-emerald-500/70 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Sliders className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>V2 Route Engine (Modern)</span>
                      </div>
                      <Checkbox
                        checked={enableV2Routes}
                        tabIndex={-1}
                        className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Multi-slide bilingual layouts & split-screen Unicode Kannada
                    </p>
                  </div>

                  {/* Card: V1 Route Legacy */}
                  <div
                    role="checkbox"
                    aria-checked={enableV1Routes}
                    tabIndex={0}
                    onClick={() => {
                      setEnableV1Routes(!enableV1Routes);
                      clearError("routes");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEnableV1Routes(!enableV1Routes);
                        clearError("routes");
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      enableV1Routes
                        ? "border-amber-500/70 bg-amber-500/5 text-foreground ring-1 ring-amber-500/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Layers className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>V1 Route Legacy</span>
                      </div>
                      <Checkbox
                        checked={enableV1Routes}
                        tabIndex={-1}
                        className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Backwards compatibility for legacy onboard LED microcontrollers
                    </p>
                  </div>
                </div>
              </div>
            )}

            <FieldErrorText message={errors.modules || errors.routes} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* Step 3: Administrative Regions - Full Width Horizontal Card List */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-3 py-2">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Administrative Regions
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define the administrative operating regions governing this undertaking.
              </p>
            </div>

            {/* Quick-Add Card */}
            <Card className="p-3 border bg-muted/20 shadow-none">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="region-name-input" className="text-xs font-semibold">
                    Region Name *
                  </Label>
                  <Input
                    id="region-name-input"
                    type="text"
                    value={newRegionName}
                    onChange={(e) => {
                      setNewRegionName(e.target.value);
                      clearError("newRegionName");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddRegion();
                      }
                    }}
                    placeholder="e.g. Bangalore Central Region, Mysore Region..."
                    aria-invalid={Boolean(errors.newRegionName)}
                    autoFocus
                  />
                  <FieldErrorText message={errors.newRegionName} />
                </div>

                <div className="pt-5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddRegion}
                    className="h-8 text-xs font-semibold gap-1 px-4"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Region</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Full-Width Horizontal Region Card List */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="font-semibold text-foreground">
                  Configured Regions ({regions.length})
                </span>
               
              </div>

              {regions.length === 0 ? (
                <Empty className="py-6 border rounded-lg bg-card">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Compass className="h-4 w-4" />
                    </EmptyMedia>
                    <EmptyTitle className="text-xs font-semibold">
                      No administrative regions added
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Add at least one region to map child bus depots.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {regions.map((reg) => {
                    const assignedDepotCount = depots.filter(
                      (d) => d.regionName === reg.name
                    ).length;
                    return (
                      <Card
                        key={reg.name}
                        className="w-full p-3 border shadow-2xs hover:border-border/80 transition-all flex flex-row items-center justify-between gap-3"
                      >
                        <div className="flex flex-row items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Compass className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">
                              {reg.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground block mt-0.5">
                              {assignedDepotCount} depot(s) mapped
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRegion(reg.name)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          aria-label={`Remove region ${reg.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}

              <FieldErrorText message={errors.regionsList} />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Step 4: Depots & Operational Units - Using shadcn Select */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-3 py-2">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Operational Bus Depots
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register bus depots and map each depot to its parent administrative region.
              </p>
            </div>

            {/* Quick-Add Card */}
            <Card className="p-3 border bg-muted/20 shadow-none">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                 <div className="sm:col-span-5 space-y-1">
                  <Label htmlFor="depot-region-select" className="text-xs font-semibold">
                    Parent Region *
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={newDepotRegion}
                        onValueChange={(val) => {
                          setNewDepotRegion(val || "");
                          clearError("newDepotRegion");
                        }}
                      >
                        <SelectTrigger
                          id="depot-region-select"
                          aria-invalid={Boolean(errors.newDepotRegion)}
                          className="h-8 w-full text-xs"
                        >
                          <SelectValue placeholder="Select parent region" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((r) => (
                            <SelectItem key={r.name} value={r.name}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                   
                  </div>
                  <FieldErrorText message={errors.newDepotRegion} />
                </div>
                <div className="sm:col-span-5 space-y-1">
                  <Label htmlFor="depot-name-input" className="text-xs font-semibold">
                    Depot Name *
                  </Label>
                  <Input
                    id="depot-name-input"
                    type="text"
                    value={newDepotName}
                    onChange={(e) => {
                      setNewDepotName(e.target.value);
                      clearError("newDepotName");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDepot();
                      }
                    }}
                    placeholder="e.g. Depot 28 - Hebbal"
                    aria-invalid={Boolean(errors.newDepotName)}
                    autoFocus
                  />
                  
                  <FieldErrorText message={errors.newDepotName} />
                  
                </div>
                      <Button
                      type="button"
                      size="sm"
                      onClick={handleAddDepot}
                      className="h-8 col-span-2 text-xs font-semibold gap-1 px-3 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Depot</span>
                    </Button>
               
              </div>
            </Card>

            {/* Full-Width Horizontal Depot Card List */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="font-semibold text-foreground">
                  Configured Depots ({depots.length})
                </span>
                <span className="text-[11px]">Horizontal full-width cards</span>
              </div>

              {depots.length === 0 ? (
                <Empty className="py-6 border rounded-lg bg-card">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Warehouse className="h-4 w-4" />
                    </EmptyMedia>
                    <EmptyTitle className="text-xs font-semibold">
                      No bus depots configured yet
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Register at least one depot to proceed with provisioning.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {depots.map((dep) => (
                    <Card
                      key={dep.name}
                      className="w-full p-3 border shadow-2xs hover:border-border/80 transition-all flex flex-row items-center justify-between gap-3"
                    >
                      <div className="flex flex-row items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Warehouse className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-foreground block truncate">
                            {dep.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 text-muted-foreground"
                            >
                              Region: {dep.regionName}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDepot(dep.name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        aria-label={`Remove depot ${dep.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              <FieldErrorText message={errors.depotsList} />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Step 5: Administrator Account & Review */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-4 py-2">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Master Administrator Credentials & Review
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure initial Organization Admin login credentials and review tenant setup details.
              </p>
            </div>

            {/* Admin Credentials Card */}
            <Card className="p-4 border bg-muted/20 shadow-none space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-email-input" className="text-xs font-semibold">
                    Administrator Login Email *
                  </Label>
                  <Input
                    id="admin-email-input"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      clearError("adminEmail");
                    }}
                    placeholder="admin@agency.gov.in"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.adminEmail)}
                    autoFocus
                  />
                  <FieldErrorText message={errors.adminEmail} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-pwd-input" className="text-xs font-semibold">
                    Initial Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-pwd-input"
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        clearError("adminPassword");
                      }}
                      placeholder="Enter your password"
                      autoComplete="new-password"
                      className="pr-8"
                      aria-invalid={Boolean(errors.adminPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <FieldErrorText message={errors.adminPassword} />
                </div>
              </div>
            </Card>

            {/* Comprehensive Review Card */}
            <Card className="p-3.5 border shadow-2xs space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Provisioning Summary Preview
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="space-y-1 border-r border-border/60 pr-2">
                  <span className="text-muted-foreground text-[11px] block">Agency</span>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{name || "—"}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Contact: {email || "—"}
                  </span>
                </div>

                <div className="space-y-1 border-r border-border/60 pr-2">
                  <span className="text-muted-foreground text-[11px] block">Hierarchy Structure</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs py-0.5">
                      <Compass className="h-3 w-3 mr-1" />
                      {regions.length} Regions
                    </Badge>
                    <Badge variant="secondary" className="text-xs py-0.5">
                      <Warehouse className="h-3 w-3 mr-1" />
                      {depots.length} Depots
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Phone: {phone || "—"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px] block">Enabled Capabilities</span>
                  <div className="flex flex-wrap gap-1">
                    {enablePIS && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-blue-500/10 text-blue-600 border-blue-200">
                        PIS
                      </Badge>
                    )}
                    {enablePAS && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-indigo-500/10 text-indigo-600 border-indigo-200">
                        PAS
                      </Badge>
                    )}
                    {enableITMS && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-cyan-500/10 text-cyan-600 border-cyan-200">
                        ITMS
                      </Badge>
                    )}
                    {enablePIS && enableV2Routes && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                        V2
                      </Badge>
                    )}
                    {enablePIS && enableV1Routes && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-amber-500/10 text-amber-600 border-amber-200">
                        V1
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Error Message if API fails */}
            {errors.submit && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Provisioning Failed</span>
                  <span>{errors.submit}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wizard Footer Controls */}
        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={currentStep === 1 ? handleClose : handleBack}
            disabled={isSubmitting}
            className="text-xs"
          >
            {currentStep === 1 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                disabled={isValidatingStep}
                className="text-xs font-semibold gap-1"
              >
                {isValidatingStep ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitProvisioning}
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Submit
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default STUOnboardingWizardDialog;
