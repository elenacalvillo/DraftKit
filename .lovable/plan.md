
# Two-Tier Monetization Strategy Implementation

## Executive Summary

This plan implements a Free/Pro tiered system for DraftKit, gating high-value features for professional creators while keeping the platform accessible to all. The price point of $12/month aligns with premium Substack subscriptions, positioning DraftKit as a professional tool.

---

## Tier Breakdown

| Feature | Free Tier | Pro Tier ($12/mo) |
|---------|-----------|-------------------|
| Active Collaborations | 1 at a time | Unlimited |
| SMART Matching | Basic (3 matches) | Deep archive analysis |
| Exporting | Copy to Clipboard only | Google Docs + Word |
| Calendar Mode | Fixed to "Target Publication Date" | Async vs. Discovery toggle |
| Directory Privacy | Public | Option to hide profile |

---

## Technical Implementation

### Phase 1: Database Schema Updates

**Modify `creators` table** to add subscription tracking:

```sql
ALTER TABLE creators ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE creators ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE creators ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE creators ADD COLUMN stripe_subscription_id TEXT;
```

The existing `user_roles` table with `app_role: "pro"` enum will continue to work for manual pro assignments (early adopters, lifetime deals). The new `subscription_tier` column handles Stripe-managed subscriptions.

**New helper function** to check pro access (combines both methods):

```sql
CREATE OR REPLACE FUNCTION public.is_pro_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = 'pro'
  )
  OR EXISTS (
    SELECT 1 FROM creators 
    WHERE user_id = _user_id 
    AND subscription_tier = 'pro'
    AND (trial_ends_at IS NULL OR trial_ends_at > NOW())
  )
$$;
```

---

### Phase 2: Frontend Tier Hook

**File: `src/hooks/usePro.ts`** (update existing)

Enhance to check both `user_roles` and `subscription_tier`:

```typescript
export function usePro() {
  const { user, creator } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ["isPro", user?.id, creator?.id],
    queryFn: async () => {
      if (!user?.id) return { isPro: false, tier: 'free', trialEndsAt: null };
      
      // Check user_roles for manual pro (early adopters)
      const { data: hasRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "pro",
      });
      
      // Check creator subscription
      const { data: creatorData } = await supabase
        .from('creators')
        .select('subscription_tier, trial_ends_at')
        .eq('user_id', user.id)
        .single();
      
      const isInTrial = creatorData?.trial_ends_at && 
        new Date(creatorData.trial_ends_at) > new Date();
      
      return {
        isPro: hasRole || creatorData?.subscription_tier === 'pro' || isInTrial,
        tier: creatorData?.subscription_tier || 'free',
        trialEndsAt: creatorData?.trial_ends_at,
        isInTrial,
      };
    },
    enabled: !!user?.id,
  });

  return { 
    isPro: data?.isPro ?? false, 
    tier: data?.tier ?? 'free',
    trialEndsAt: data?.trialEndsAt,
    isInTrial: data?.isInTrial ?? false,
    isLoading 
  };
}
```

---

### Phase 3: Active Collaboration Counting

**New Hook: `src/hooks/useActiveCollabs.ts`**

```typescript
export function useActiveCollabs() {
  const { creator } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ["activeCollabs", creator?.id],
    queryFn: async () => {
      if (!creator?.id) return { count: 0, limit: 1, canApprove: true };
      
      const { count } = await supabase
        .from('collab_requests')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creator.id)
        .eq('status', 'approved');
      
      return { count: count || 0 };
    },
    enabled: !!creator?.id,
  });

  return { activeCount: data?.count ?? 0, isLoading };
}
```

---

### Phase 4: Feature Gates

#### 4.1 Collaboration Limit Gate

**File: `src/pages/Requests.tsx`**

Modify `handleApprove` to check collaboration limits:

```typescript
const handleApprove = async (id: string) => {
  // For free users, check if they already have an active collab
  if (!isPro && activeCount >= 1) {
    toast.error("Free tier is limited to 1 active collaboration", {
      description: "Upgrade to Pro for unlimited collaborations",
      action: {
        label: "Go Pro",
        onClick: () => navigate("/dashboard/settings?upgrade=true"),
      },
    });
    return;
  }
  // ... existing approve logic
};
```

**File: `src/components/requests/RequestCard.tsx`**

Disable approve button when at limit:

```typescript
<Button
  variant="gradient"
  className="flex-1"
  onClick={() => onApprove?.(request.id)}
  disabled={!canApprove}
>
  {canApprove ? "Approve" : "Limit Reached"}
</Button>
```

#### 4.2 Export Feature Gate

**File: `src/components/requests/CollabDraftModal.tsx`**

Show/hide export options based on tier:

```typescript
const { isPro } = usePro();

// In the dropdown menu:
{isPro ? (
  <>
    <DropdownMenuItem onClick={handleExportToWord}>
      <FileText className="w-4 h-4 mr-2" />
      Download as Word (.docx)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleExportToGoogleDocs}>
      <FileIcon className="w-4 h-4 mr-2" />
      Open in Google Docs
    </DropdownMenuItem>
  </>
) : (
  <DropdownMenuItem 
    onClick={() => navigate("/dashboard/settings?upgrade=true")}
    className="text-muted-foreground"
  >
    <Crown className="w-4 h-4 mr-2" />
    Upgrade for Export Options
  </DropdownMenuItem>
)}
```

#### 4.3 Calendar Mode Gate

**File: `src/pages/Settings.tsx`**

Lock collaboration mode selector for free users:

```typescript
const { isPro } = usePro();

{/* Collaboration Mode Selector */}
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <Label>How do you prefer to collaborate?</Label>
    {!isPro && (
      <Badge variant="outline" className="text-xs">
        <Crown className="w-3 h-3 mr-1" />
        Pro
      </Badge>
    )}
  </div>
  {isPro ? (
    // ... existing mode selector
  ) : (
    <div className="p-4 bg-muted/50 rounded-xl border border-dashed">
      <p className="text-sm text-muted-foreground">
        Free accounts use "100% Async" mode with Target Publication Dates.
      </p>
      <Button variant="link" className="p-0 h-auto mt-2">
        Upgrade to customize your collaboration style
      </Button>
    </div>
  )}
</div>
```

---

### Phase 5: Upgrade UI Components

**New Component: `src/components/subscription/UpgradePrompt.tsx`**

A reusable upgrade modal/card:

```typescript
interface UpgradePromptProps {
  feature: 'export' | 'collabs' | 'mode';
  onUpgrade: () => void;
}

const FEATURE_COPY = {
  export: {
    title: "Export to Google Docs & Word",
    description: "One-click export to your favorite writing tools",
  },
  collabs: {
    title: "Unlimited Collaborations",
    description: "Work with as many creators as you want, simultaneously",
  },
  mode: {
    title: "Custom Collaboration Playbook",
    description: "Toggle between Async and Discovery modes",
  },
};
```

**New Page: `src/pages/Pricing.tsx`** (or section in Settings)

Display pricing with feature comparison table.

---

### Phase 6: Stripe Integration

**Enable Stripe Connector** to handle:
- Customer creation on signup
- Subscription management ($12/month)
- Webhook handling for subscription status changes

**New Edge Function: `supabase/functions/handle-subscription-webhook/index.ts`**

Updates `creators.subscription_tier` based on Stripe events:
- `customer.subscription.created` → set tier to 'pro'
- `customer.subscription.deleted` → set tier to 'free'
- `customer.subscription.updated` → handle plan changes

---

### Phase 7: Founding Member Trial Logic

For launch, auto-enroll new signups in 30-day Pro trial:

**File: `supabase/functions/send-collab-email/index.ts`** (or new trigger)

On creator insert, set `trial_ends_at` to 30 days from now:

```sql
CREATE OR REPLACE FUNCTION set_founder_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Only during founding period (adjust date as needed)
  IF NOW() < '2026-03-01'::TIMESTAMPTZ THEN
    NEW.subscription_tier := 'pro';
    NEW.trial_ends_at := NOW() + INTERVAL '30 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creator_founder_trial
BEFORE INSERT ON creators
FOR EACH ROW EXECUTE FUNCTION set_founder_trial();
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/usePro.ts` | Modify | Enhanced tier checking |
| `src/hooks/useActiveCollabs.ts` | Create | Track active collaboration count |
| `src/pages/Requests.tsx` | Modify | Gate approve action |
| `src/components/requests/RequestCard.tsx` | Modify | Disable approve button when at limit |
| `src/components/requests/CollabDraftModal.tsx` | Modify | Gate export options |
| `src/pages/Settings.tsx` | Modify | Gate collaboration mode toggle |
| `src/components/subscription/UpgradePrompt.tsx` | Create | Reusable upgrade CTA |
| `src/components/subscription/ProBadge.tsx` | Create | Visual indicator for Pro features |
| Database migration | Create | Add subscription columns to creators |
| Stripe edge functions | Create | Handle subscription webhooks |

---

## Implementation Order

1. **Database migration** - Add subscription columns and helper function
2. **Update `usePro` hook** - Support both role-based and subscription-based Pro
3. **Create `useActiveCollabs` hook** - Count active collaborations
4. **Gate collaboration approvals** - Free tier limit enforcement
5. **Gate export features** - Hide advanced export for free tier
6. **Gate settings** - Lock collaboration mode for free tier
7. **Build upgrade UI** - Prompts and pricing display
8. **Stripe integration** - Payment processing and webhooks
9. **Founding member logic** - Auto-trial for early signups
