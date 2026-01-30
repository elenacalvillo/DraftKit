import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Palette, Lock, Crown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePro } from "@/hooks/usePro";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  THEME_PRESETS, 
  PRESET_IDS,
  parseProfileTheme,
  getPreviewGradient,
  serializeTheme,
  type ProfileTheme,
  type ThemePresetId
} from "@/lib/theme-presets";
import { ProBadge } from "@/components/subscription/ProBadge";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";

export function ProfileStyleSection() {
  const { creator, refreshCreator } = useAuth();
  const { isPro } = usePro();
  const { trackEvent } = useAnalytics();
  const [isSaving, setIsSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  
  // Theme state
  const [selectedPreset, setSelectedPreset] = useState<ThemePresetId>('default');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customColors, setCustomColors] = useState({
    start: '#F56B2A',
    end: '#D4501F',
    angle: 135,
  });
  
  // Initialize from creator's current theme
  useEffect(() => {
    if (!creator) return;
    
    const theme = parseProfileTheme((creator as any).profile_theme);
    
    if (theme.custom) {
      setIsCustomMode(true);
      setCustomColors({
        start: theme.custom.colors[0] || '#F56B2A',
        end: theme.custom.colors[1] || '#D4501F',
        angle: theme.custom.angle,
      });
    } else {
      setIsCustomMode(false);
      setSelectedPreset(theme.preset || 'default');
    }
  }, [creator?.id]);
  
  // Build current theme for preview
  const currentTheme: ProfileTheme = useMemo(() => {
    if (isCustomMode) {
      return {
        custom: {
          type: 'linear',
          colors: [customColors.start, customColors.end],
          angle: customColors.angle,
        },
      };
    }
    return { preset: selectedPreset };
  }, [isCustomMode, selectedPreset, customColors]);
  
  const previewGradient = getPreviewGradient(currentTheme);
  
  const handlePresetClick = (presetId: ThemePresetId) => {
    const preset = THEME_PRESETS[presetId];
    
    // Check if Pro-only preset and user is not Pro
    if (preset.isPro && !isPro) {
      trackEvent("profile_theme_upgrade_prompt_shown" as any, { preset: presetId });
      setShowUpgrade(true);
      return;
    }
    
    setIsCustomMode(false);
    setSelectedPreset(presetId);
    setShowUpgrade(false);
  };
  
  const handleCustomModeToggle = () => {
    if (!isPro) {
      trackEvent("profile_theme_upgrade_prompt_shown" as any, { feature: 'custom_colors' });
      setShowUpgrade(true);
      return;
    }
    setIsCustomMode(true);
    setShowUpgrade(false);
  };
  
  const handleSave = async () => {
    if (!creator) return;
    
    setIsSaving(true);
    
    const themeData = serializeTheme(currentTheme);
    
    const { error } = await supabase
      .from('creators')
      .update({ profile_theme: themeData as any })
      .eq('id', creator.id);
    
    if (error) {
      toast.error("Failed to save theme");
      setIsSaving(false);
      return;
    }
    
    await refreshCreator();
    
    trackEvent("profile_theme_changed" as any, { 
      theme_type: isCustomMode ? 'custom' : 'preset',
      preset: isCustomMode ? null : selectedPreset,
    });
    
    toast.success("Theme saved successfully!");
    setIsSaving(false);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Palette className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Profile Style</h2>
        {!isPro && <ProBadge size="sm" />}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Customize the background gradient on your public booking page to match your brand.
      </p>
      
      {/* Live Preview */}
      <div className="mb-6">
        <Label className="mb-2 block">Preview</Label>
        <div 
          className="relative h-32 rounded-xl overflow-hidden"
          style={{ background: previewGradient }}
        >
          {/* Mini profile mockup */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div 
                className="w-12 h-12 rounded-full bg-background/90 flex items-center justify-center shadow-lg"
                style={{ boxShadow: `0 0 20px hsla(${THEME_PRESETS[selectedPreset]?.colors.glow || '12 76% 61%'} / 0.4)` }}
              >
                <span className="text-lg font-bold text-foreground">
                  {creator?.name?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium text-white drop-shadow-md">
                {creator?.name || 'Your Name'}
              </div>
            </div>
          </div>
          {/* Floating orbs */}
          <div className="absolute top-1/4 -right-8 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>
      
      {/* Preset Grid */}
      <div className="mb-6">
        <Label className="mb-3 block">Theme Presets</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESET_IDS.map((presetId) => {
            const preset = THEME_PRESETS[presetId];
            const isSelected = !isCustomMode && selectedPreset === presetId;
            const isLocked = preset.isPro && !isPro;
            
            return (
              <button
                key={presetId}
                onClick={() => handlePresetClick(presetId)}
                className={`relative p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-muted-foreground/20'
                } ${isLocked ? 'cursor-pointer' : ''}`}
              >
                {/* Gradient Swatch */}
                <div 
                  className="h-12 rounded-lg mb-2"
                  style={{ 
                    background: `linear-gradient(${preset.angle}deg, hsl(${preset.colors.primary}), hsl(${preset.colors.secondary}))` 
                  }}
                />
                
                {/* Name */}
                <div className="text-xs font-medium text-left">{preset.name}</div>
                
                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                
                {/* Pro lock overlay */}
                {isLocked && (
                  <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      <span>Pro</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Custom Color Picker */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Label>Custom Colors</Label>
          {!isPro && <ProBadge size="sm" />}
        </div>
        
        {isPro ? (
          <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setIsCustomMode(true)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isCustomMode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                Custom
              </button>
            </div>
            
            {isCustomMode && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Start Color</Label>
                    <div className="flex gap-2">
                      <div 
                        className="w-10 h-10 rounded-lg border cursor-pointer"
                        style={{ backgroundColor: customColors.start }}
                      >
                        <input
                          type="color"
                          value={customColors.start}
                          onChange={(e) => setCustomColors(prev => ({ ...prev, start: e.target.value }))}
                          className="opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <Input
                        value={customColors.start}
                        onChange={(e) => setCustomColors(prev => ({ ...prev, start: e.target.value }))}
                        className="font-mono text-xs uppercase"
                        placeholder="#F56B2A"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">End Color</Label>
                    <div className="flex gap-2">
                      <div 
                        className="w-10 h-10 rounded-lg border cursor-pointer"
                        style={{ backgroundColor: customColors.end }}
                      >
                        <input
                          type="color"
                          value={customColors.end}
                          onChange={(e) => setCustomColors(prev => ({ ...prev, end: e.target.value }))}
                          className="opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <Input
                        value={customColors.end}
                        onChange={(e) => setCustomColors(prev => ({ ...prev, end: e.target.value }))}
                        className="font-mono text-xs uppercase"
                        placeholder="#D4501F"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Gradient Angle</Label>
                    <span className="text-xs text-muted-foreground">{customColors.angle}°</span>
                  </div>
                  <Slider
                    value={[customColors.angle]}
                    onValueChange={([value]) => setCustomColors(prev => ({ ...prev, angle: value }))}
                    min={0}
                    max={360}
                    step={15}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleCustomModeToggle}
            className="w-full p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Palette className="w-4 h-4" />
              <span className="text-sm">Unlock custom colors with Pro</span>
            </div>
          </button>
        )}
      </div>
      
      {/* Upgrade prompt */}
      {showUpgrade && !isPro && (
        <div className="mb-6">
          <UpgradePrompt feature="style" variant="card" />
        </div>
      )}
      
      {/* Save Button */}
      <Button
        variant="gradient"
        onClick={handleSave}
        className="w-full"
        disabled={isSaving}
      >
        {isSaving ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
          />
        ) : (
          "Save Theme"
        )}
      </Button>
    </motion.div>
  );
}
