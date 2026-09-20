package expo.modules.schoolbiometric

import android.os.Handler
import android.os.Looper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

class SchoolBiometricModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SchoolBiometric")

    AsyncFunction("authenticate") { promptMessage: String, promise: Promise ->
      val activity = try {
        (appContext.currentActivity ?: appContext.throwingActivity) as? FragmentActivity
      } catch (_: Exception) {
        null
      }

      if (activity == null) {
        promise.resolve(result(false, "missing_activity", "No activity"))
        return@AsyncFunction
      }

      val manager = BiometricManager.from(activity.applicationContext)
      when (manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
        BiometricManager.BIOMETRIC_SUCCESS -> Unit
        BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
          promise.resolve(result(false, "not_enrolled", "No fingerprint enrolled"))
          return@AsyncFunction
        }
        BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
        BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
        BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
        BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
          promise.resolve(result(false, "not_available", "Fingerprint hardware unavailable"))
          return@AsyncFunction
        }
        else -> {
          promise.resolve(result(false, "not_available", "Fingerprint not available"))
          return@AsyncFunction
        }
      }

      runWhenReady(activity) {
        startPrompt(activity, promptMessage, promise)
      }
    }
  }

  private fun startPrompt(activity: FragmentActivity, promptMessage: String, promise: Promise) {
    if (activity.isFinishing || activity.isDestroyed) {
      promise.resolve(result(false, "missing_activity", "Activity gone"))
      return
    }

    val settled = AtomicBoolean(false)
    fun finish(success: Boolean, error: String? = null, warning: String? = null) {
      if (settled.compareAndSet(false, true)) {
        promise.resolve(result(success, error, warning))
      }
    }

    try {
      val executor = ContextCompat.getMainExecutor(activity)
      val prompt = BiometricPrompt(
        activity,
        executor,
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(authResult: BiometricPrompt.AuthenticationResult) {
            finish(true)
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            finish(false, convertError(errorCode), errString.toString())
          }

          override fun onAuthenticationFailed() {
            // Wrong finger — keep the system prompt open.
          }
        },
      )

      val title = promptMessage.ifBlank { "Confirm fingerprint" }
      val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle(title)
        .setSubtitle("Touch the fingerprint sensor")
        .setNegativeButtonText("Cancel")
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
        .setConfirmationRequired(false)
        .build()

      prompt.authenticate(info)
    } catch (e: Exception) {
      finish(false, "unknown", e.message ?: e.javaClass.simpleName)
    }
  }

  private fun runWhenReady(activity: FragmentActivity, action: () -> Unit) {
    val delayMs = if (activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) 280L else 700L
    activity.runOnUiThread {
      Handler(Looper.getMainLooper()).postDelayed({
        if (activity.isFinishing || activity.isDestroyed) return@postDelayed
        action()
      }, delayMs)
    }
  }

  private fun convertError(code: Int): String =
    when (code) {
      BiometricPrompt.ERROR_CANCELED,
      BiometricPrompt.ERROR_NEGATIVE_BUTTON,
      BiometricPrompt.ERROR_USER_CANCELED -> "user_cancel"
      BiometricPrompt.ERROR_HW_NOT_PRESENT,
      BiometricPrompt.ERROR_HW_UNAVAILABLE,
      BiometricPrompt.ERROR_NO_BIOMETRICS,
      BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> "not_available"
      BiometricPrompt.ERROR_LOCKOUT,
      BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "lockout"
      BiometricPrompt.ERROR_TIMEOUT -> "timeout"
      BiometricPrompt.ERROR_UNABLE_TO_PROCESS -> "unable_to_process"
      else -> "unknown"
    }

  private fun result(success: Boolean, error: String? = null, warning: String? = null): Map<String, Any> {
    val out = mutableMapOf<String, Any>("success" to success)
    if (error != null) out["error"] = error
    if (warning != null) out["warning"] = warning
    return out
  }
}
