

# Add Password Show/Hide Toggle

## Summary

Add an eye icon button to password fields that allows users to toggle between showing and hiding their password. This is a standard UX pattern that helps users verify what they typed, especially on signup and password reset pages.

---

## Pages to Update

| Page | Password Fields |
|------|-----------------|
| Login | 1 field (password) |
| Signup | 1 field (password) |
| ResetPassword | 2 fields (new password, confirm password) |

---

## How It Will Look

```text
+------------------------------------------+
| Password                                 |
| +--------------------------------------+ |
| | ••••••••                         [👁] | |
| +--------------------------------------+ |
+------------------------------------------+

Click the eye icon:

+------------------------------------------+
| Password                                 |
| +--------------------------------------+ |
| | myPassword123                    [👁‍🗨] | |
| +--------------------------------------+ |
+------------------------------------------+
```

---

## Technical Approach

### 1. Add State for Password Visibility

Each page will get a state variable to track visibility:

```typescript
// Login.tsx - single field
const [showPassword, setShowPassword] = useState(false);

// ResetPassword.tsx - two fields
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
```

### 2. Import Eye Icons from Lucide

```typescript
import { Eye, EyeOff } from "lucide-react";
```

### 3. Wrap Input with Toggle Button

Replace the plain `<Input>` with a wrapper that includes the toggle:

```typescript
<div className="relative">
  <Input
    type={showPassword ? "text" : "password"}
    // ... other props
    className="h-12 pr-10"
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    tabIndex={-1}
  >
    {showPassword ? (
      <EyeOff className="w-4 h-4" />
    ) : (
      <Eye className="w-4 h-4" />
    )}
  </button>
</div>
```

---

## Files to Modify

### 1. Login.tsx
- Add `showPassword` state
- Import `Eye` and `EyeOff` icons
- Wrap password input with relative container
- Add toggle button with eye icon
- Change input type dynamically

### 2. Signup.tsx
- Same changes as Login.tsx for the password field in Step 1

### 3. ResetPassword.tsx
- Add `showPassword` and `showConfirmPassword` states
- Apply toggle to both password fields independently
- Users can show/hide each field separately

---

## Accessibility Considerations

- The toggle button uses `type="button"` to prevent form submission
- `tabIndex={-1}` keeps the button out of the tab order (users can still click it, but tab goes from password field to next field)
- The button has hover states for visual feedback
- Icons are intuitive: closed eye = password hidden, open eye = password visible

---

## Expected Outcome

After this change:
- Users can click the eye icon to see what they typed
- Clicking again hides the password
- Works on Login, Signup (Step 1), and Reset Password pages
- Helps prevent typos during signup when users can't see their password

