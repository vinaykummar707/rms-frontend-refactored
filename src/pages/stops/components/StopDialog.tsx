import React, { useState, useEffect } from "react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StopAudioStudio } from "./StopAudioStudio";
import { checkStopNameDuplicate } from "@/features/stops/services/stopService";
import type { IStopWithAudio, IStopCreate, IStopUpdate, IStopAudio } from "@/shared/types/stop";
import {
  MapPin,
  Compass,
  Volume2,
  AlertCircle,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

interface StopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop?: IStopWithAudio | null;
  depotId: string;
  organizationId: string;
  onSave: (
    payload: IStopCreate | IStopUpdate,
    audioFile?: File | null,
    deleteExistingAudio?: boolean,
    existingAudio?: { id?: string; url?: string }
  ) => Promise<any>;
}

export function StopDialog({
  open,
  onOpenChange,
  stop,
  depotId,
  organizationId,
  onSave,
}: StopDialogProps) {
  const isEdit = Boolean(stop);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Fields - Step 1
  const [formName, setFormName] = useState("");
  const [formNameError, setFormNameError] = useState("");

  const [upLat, setUpLat] = useState("");
  const [upLatError, setUpLatError] = useState("");

  const [upLon, setUpLon] = useState("");
  const [upLonError, setUpLonError] = useState("");

  const [downLat, setDownLat] = useState("");
  const [downLatError, setDownLatError] = useState("");

  const [downLon, setDownLon] = useState("");
  const [downLonError, setDownLonError] = useState("");

  const [formActive, setFormActive] = useState(true);

  // Audio Upload / Management - Step 2
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [audioFileError, setAudioFileError] = useState("");
  const [markedDeleteExistingAudio, setMarkedDeleteExistingAudio] = useState(false);

  const [isCheckingStep, setIsCheckingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { num: 1, title: "Stop Information", icon: MapPin },
    { num: 2, title: "Public Address Audio", icon: Volume2 },
  ];

  // Existing Audio extraction
  const existingAudio: IStopAudio | null = React.useMemo(() => {
    if (!stop?.stop_audios) return null;
    if (Array.isArray(stop.stop_audios)) {
      return stop.stop_audios[0] || null;
    }
    return stop.stop_audios;
  }, [stop]);

  // Reset form values on open or stop change
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      if (stop) {
        setFormName(stop.name || "");
        setUpLat(stop.up_latitude != null ? String(stop.up_latitude) : "");
        setUpLon(stop.up_longitude != null ? String(stop.up_longitude) : "");
        setDownLat(stop.down_latitude != null ? String(stop.down_latitude) : "");
        setDownLon(stop.down_longitude != null ? String(stop.down_longitude) : "");
        setFormActive(stop.active !== false);
      } else {
        setFormName("");
        setUpLat("");
        setUpLon("");
        setDownLat("");
        setDownLon("");
        setFormActive(true);
      }
      setFormNameError("");
      setUpLatError("");
      setUpLonError("");
      setDownLatError("");
      setDownLonError("");
      setSelectedAudioFile(null);
      setAudioFileError("");
      setMarkedDeleteExistingAudio(false);
    }
  }, [open, stop]);

  // Sanitize and handle coordinate inputs (Alphabets strictly forbidden; supports real-world decimal formats like 90.2112)
  const handleCoordinateChange = (
    val: string,
    setter: (val: string) => void,
    errorSetter: (err: string) => void
  ) => {
    if (/[a-zA-Z]/.test(val)) {
      errorSetter("Alphabets are not allowed. Please enter a valid decimal number.");
      val = val.replace(/[a-zA-Z]/g, "");
    } else {
      errorSetter("");
    }

    // Clean any invalid characters, keeping only digits, negative sign, and single decimal point
    const sanitized = val
      .replace(/[^0-9.-]/g, "")
      .replace(/(?!^)-/g, "")
      .replace(/(\..*)\./g, "$1");

    setter(sanitized);

    // Validate real-world format
    if (sanitized.trim().length > 0 && sanitized !== "-" && sanitized !== ".") {
      const num = parseFloat(sanitized);
      if (isNaN(num)) {
        errorSetter("Must be a valid decimal number.");
      } else if (Math.abs(num) > 180) {
        errorSetter("Coordinate value must be within -180 to 180 degrees.");
      } else {
        errorSetter("");
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Step 1 -> Step 2 Validation
  const handleNext = async () => {
    let hasError = false;
    const trimmedName = formName.trim();

    // 1. Stop Name validation
    if (!trimmedName) {
      setFormNameError("Stop name is required.");
      hasError = true;
    } else {
      setFormNameError("");
    }

    // 2. Coordinate validations (Required, Real-world decimal formats, strictly no alphabets)
    const validateCoord = (
      val: string,
      setterError: (err: string) => void,
      label: string
    ) => {
      const v = val.trim();
      if (!v) {
        setterError(`${label} is required.`);
        hasError = true;
        return;
      }
      if (/[a-zA-Z]/.test(v)) {
        setterError(`${label}: Alphabets are not allowed.`);
        hasError = true;
        return;
      }
      const num = parseFloat(v);
      if (isNaN(num)) {
        setterError(`${label} must be a valid decimal number.`);
        hasError = true;
        return;
      }
      if (Math.abs(num) > 180) {
        setterError(`${label} must be within -180 to 180 degrees.`);
        hasError = true;
        return;
      }
      setterError("");
    };

    validateCoord(upLat, setUpLatError, "Up Latitude");
    validateCoord(upLon, setUpLonError, "Up Longitude");
    validateCoord(downLat, setDownLatError, "Down Latitude");
    validateCoord(downLon, setDownLonError, "Down Longitude");

    if (hasError) return;

    // 3. Duplicate check for stop name in this depot
    try {
      setIsCheckingStep(true);
      const isDuplicate = await checkStopNameDuplicate(
        trimmedName,
        depotId,
        stop?.id
      );

      if (isDuplicate) {
        setFormNameError(`A stop named "${trimmedName}" already exists in this depot.`);
        return;
      }
    } catch (err: any) {
      console.warn("Stop duplicate check error:", err);
    } finally {
      setIsCheckingStep(false);
    }

    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  // Form Submission on Step 2
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep === 1) {
      await handleNext();
      return;
    }

    const trimmedName = formName.trim();
    if (!trimmedName || !upLat.trim() || !upLon.trim() || !downLat.trim() || !downLon.trim()) {
      setCurrentStep(1);
      await handleNext();
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: any = {
        name: trimmedName,
        up_latitude: upLat.trim(),
        up_longitude: upLon.trim(),
        down_latitude: downLat.trim(),
        down_longitude: downLon.trim(),
        active: Boolean(formActive),
        depot_id: depotId,
        organization_id: organizationId,
      };

      if (isEdit && stop) {
        payload.id = stop.id;
      }

      await onSave(
        payload,
        selectedAudioFile,
        markedDeleteExistingAudio,
        existingAudio ? { id: existingAudio.id, url: existingAudio.url } : undefined
      );

      onOpenChange(false);
    } catch (err: any) {
      console.error("Stop submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (isSubmitting || isCheckingStep)) return;
        handleClose();
      }}
      disablePointerDismissal={true}
    >
      <DialogContent className="sm:max-w-3xl p-5 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {isEdit ? "Edit Transit Stop" : "Add Transit Stop"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEdit
                  ? "Modify stop coordinates, operational status, and announcement audio."
                  : "Provision a new transit stop with coordinate waypoints and public address audio."}
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="grid grid-cols-2 gap-2 pt-3">
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
                    <span>
                      Step {step.num}: {step.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Step 1: Stop Information & Coordinates */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Stop Name */}
              <div className="space-y-1.5">
                <Label htmlFor="stop-name" className="text-xs font-semibold">
                  Stop Name *
                </Label>
                <Input
                  id="stop-name"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (formNameError) setFormNameError("");
                  }}
                  placeholder="e.g. Majestic Bus Station"
                  className={cn(
                    "h-9 text-xs",
                    formNameError && "border-destructive focus-visible:ring-destructive/20"
                  )}
                  autoFocus
                />
                <FieldErrorText message={formNameError} />
              </div>

              {/* Directional GPS Coordinates */}
              <div className="rounded-lg border border-border/80 p-3 bg-muted/20 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Compass className="h-4 w-4 text-primary shrink-0" />
                  <span>Directional GPS Coordinates</span>
                  <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                    Numbers only (e.g. 90.2112, 12.971598)
                  </span>
                </div>

                {/* Upward Direction */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Upward Direction
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <Label htmlFor="up-lat" className="text-[11px] font-semibold text-foreground">
                        Up Latitude *
                      </Label>
                      <Input
                        id="up-lat"
                        value={upLat}
                        onChange={(e) =>
                          handleCoordinateChange(e.target.value, setUpLat, setUpLatError)
                        }
                        onBlur={() => {
                          if (!upLat.trim()) setUpLatError("Up Latitude is required.");
                        }}
                        placeholder="e.g. 12.971598 or 90.2112"
                        className={cn(
                          "h-8 text-xs font-mono mt-0.5",
                          upLatError && "border-destructive focus-visible:ring-destructive/20"
                        )}
                      />
                      <FieldErrorText message={upLatError} />
                    </div>
                    <div>
                      <Label htmlFor="up-lon" className="text-[11px] font-semibold text-foreground">
                        Up Longitude *
                      </Label>
                      <Input
                        id="up-lon"
                        value={upLon}
                        onChange={(e) =>
                          handleCoordinateChange(e.target.value, setUpLon, setUpLonError)
                        }
                        onBlur={() => {
                          if (!upLon.trim()) setUpLonError("Up Longitude is required.");
                        }}
                        placeholder="e.g. 77.594566"
                        className={cn(
                          "h-8 text-xs font-mono mt-0.5",
                          upLonError && "border-destructive focus-visible:ring-destructive/20"
                        )}
                      />
                      <FieldErrorText message={upLonError} />
                    </div>
                  </div>
                </div>

                {/* Downward Direction */}
                <div className="space-y-1.5 pt-1 border-t border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Downward Direction (Return)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <Label htmlFor="down-lat" className="text-[11px] font-semibold text-foreground">
                        Down Latitude *
                      </Label>
                      <Input
                        id="down-lat"
                        value={downLat}
                        onChange={(e) =>
                          handleCoordinateChange(e.target.value, setDownLat, setDownLatError)
                        }
                        onBlur={() => {
                          if (!downLat.trim()) setDownLatError("Down Latitude is required.");
                        }}
                        placeholder="e.g. 12.971650 or 90.2112"
                        className={cn(
                          "h-8 text-xs font-mono mt-0.5",
                          downLatError && "border-destructive focus-visible:ring-destructive/20"
                        )}
                      />
                      <FieldErrorText message={downLatError} />
                    </div>
                    <div>
                      <Label htmlFor="down-lon" className="text-[11px] font-semibold text-foreground">
                        Down Longitude *
                      </Label>
                      <Input
                        id="down-lon"
                        value={downLon}
                        onChange={(e) =>
                          handleCoordinateChange(e.target.value, setDownLon, setDownLonError)
                        }
                        onBlur={() => {
                          if (!downLon.trim()) setDownLonError("Down Longitude is required.");
                        }}
                        placeholder="e.g. 77.594610"
                        className={cn(
                          "h-8 text-xs font-mono mt-0.5",
                          downLonError && "border-destructive focus-visible:ring-destructive/20"
                        )}
                      />
                      <FieldErrorText message={downLonError} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Active Status</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enable or disable this stop for route scheduling and destination displays.
                  </p>
                </div>
                <Switch
                  checked={formActive}
                  onCheckedChange={setFormActive}
                  className="data-checked:bg-emerald-600"
                />
              </div>
            </div>
          )}

          {/* Step 2: Public Address Audio */}
          {currentStep === 2 && (
            <StopAudioStudio
              stopName={formName}
              existingAudio={existingAudio}
              selectedAudioFile={selectedAudioFile}
              onSelectAudioFile={setSelectedAudioFile}
              markedDeleteExistingAudio={markedDeleteExistingAudio}
              onSetMarkedDeleteExistingAudio={setMarkedDeleteExistingAudio}
              audioFileError={audioFileError}
              onSetAudioFileError={setAudioFileError}
            />
          )}

          {/* Stepper Footer Buttons */}
          {currentStep === 1 ? (
            <DialogFooter className="flex items-center justify-end sm:justify-end pt-4 border-t border-border">
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                disabled={isSubmitting || isCheckingStep}
                className="text-xs font-semibold gap-1"
              >
                {isCheckingStep ? (
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
            </DialogFooter>
          ) : (
            <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEdit ? "Save Changes" : "Create Stop"}</span>
                )}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
