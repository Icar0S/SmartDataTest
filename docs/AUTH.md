# Auth + i18n — DataForgeTest

## Autenticação (sem banco de dados)

Fluxo:
```
/login → useAuth.handleLogin() → compara com data/users.js →
authStorage.saveSession() → step='profile' → handleSaveProfile() → navigate('/')
```

### localStorage

| Chave | Conteúdo |
|---|---|
| `dataforgetest_session` | `{userId, name, email, role, avatar, profile, loginAt, expiresAt}` |
| `dataforgetest_language` | `'pt-BR'` ou `'en-US'` |

> ⚠️ **NUNCA** salvo: senha ou hash de senha

### Expiração

- Padrão: **8 horas**
- Com "Lembrar-me": **7 dias**

---

## Migração para Backend (TODO)

Em `useAuth.js`: trocar `REGISTERED_USERS` por `fetch('/api/auth/validate')`:

```javascript
const res = await fetch(getApiUrl('/api/auth/validate'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
```

Em `authStorage.js`: salvar JWT retornado  
Em `ProtectedRoute.js`: validar JWT no header `Authorization`

---

## Usuários Demo

| E-mail | Senha | Role |
|---|---|---|
| admin@dataforgetest.com | admin123 | admin |
| engineer@dataforgetest.com | engineer123 | data_eng |
| qa@dataforgetest.com | qa123456 | tester |

---

## i18n

`LanguageContext` persiste a preferência de idioma em `'dataforgetest_language'`.

Componente de toggle: `<LanguageToggle size="sm|md" />` — visual idêntico ao `MethodologyPage`.

Para usar em qualquer componente:

```javascript
import { useLanguage } from '../context/LanguageContext';
const { language, changeLanguage } = useLanguage();
```

---

## Backend: `/api/auth/validate`

| Método | Rota | Body | Resposta |
|---|---|---|---|
| POST | `/api/auth/validate` | `{email, password}` | `200 {valid: true, user: {...}}` |
| POST | `/api/auth/validate` | senha errada | `401 {valid: false, error: "..."}` |
| POST | `/api/auth/validate` | email inválido | `401 {valid: false, error: "..."}` |
| POST | `/api/auth/validate` | campos ausentes | `400 {valid: false, error: "..."}` |

> Resposta nunca inclui `password_hash`.
