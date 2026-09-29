package expo.modules.playinappupdates

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UPDATE_REQUEST_CODE = 7301

/** Google Play In-App Updates (immediate + flexible) for the OneCampus app. */
class PlayInAppUpdatesModule : Module() {
  private var manager: AppUpdateManager? = null
  private var listenerRegistered = false

  private val installListener = InstallStateUpdatedListener { state ->
    sendEvent(
      "onInstallStatus",
      mapOf(
        "status" to statusName(state.installStatus()),
        "bytesDownloaded" to state.bytesDownloaded().toDouble(),
        "totalBytesToDownload" to state.totalBytesToDownload().toDouble(),
      ),
    )
  }

  private fun updateManager(): AppUpdateManager {
    manager?.let { return it }
    val context = appContext.reactContext
      ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)
    return AppUpdateManagerFactory.create(context).also { manager = it }
  }

  private fun ensureListener() {
    if (listenerRegistered) return
    updateManager().registerListener(installListener)
    listenerRegistered = true
  }

  override fun definition() = ModuleDefinition {
    Name("PlayInAppUpdates")

    Events("onInstallStatus", "onUpdateFlowResult")

    OnDestroy {
      if (listenerRegistered) {
        manager?.unregisterListener(installListener)
        listenerRegistered = false
      }
    }

    AsyncFunction("checkForUpdate") { promise: Promise ->
      val m = updateManager()
      ensureListener()
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          promise.resolve(
            mapOf(
              "updateAvailable" to (availability == UpdateAvailability.UPDATE_AVAILABLE),
              "updateInProgress" to
                (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
              "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
              "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
              "availableVersionCode" to info.availableVersionCode(),
              "installStatus" to statusName(info.installStatus()),
            ),
          )
        }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_UPDATE_CHECK", e.message ?: "Update check failed", e))
        }
    }

    AsyncFunction("startUpdate") { immediate: Boolean, promise: Promise ->
      val m = updateManager()
      val type = if (immediate) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          val canStart =
            (availability == UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(type)) ||
              (immediate && availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
          val activity = appContext.currentActivity
          if (!canStart || activity == null) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          if (!immediate) ensureListener()
          try {
            val started = m.startUpdateFlowForResult(
              info,
              activity,
              AppUpdateOptions.newBuilder(type).build(),
              UPDATE_REQUEST_CODE,
            )
            promise.resolve(started)
          } catch (e: Exception) {
            promise.reject(CodedException("ERR_UPDATE_START", e.message ?: "Could not start update", e))
          }
        }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_UPDATE_START", e.message ?: "Could not start update", e))
        }
    }

    AsyncFunction("completeUpdate") { promise: Promise ->
      updateManager().completeUpdate()
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e ->
          promise.reject(CodedException("ERR_UPDATE_COMPLETE", e.message ?: "Could not install update", e))
        }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == UPDATE_REQUEST_CODE) {
        val result = when (payload.resultCode) {
          Activity.RESULT_OK -> "OK"
          Activity.RESULT_CANCELED -> "CANCELED"
          else -> "FAILED"
        }
        sendEvent("onUpdateFlowResult", mapOf("result" to result))
      }
    }
  }

  private fun statusName(status: Int): String = when (status) {
    InstallStatus.PENDING -> "PENDING"
    InstallStatus.DOWNLOADING -> "DOWNLOADING"
    InstallStatus.DOWNLOADED -> "DOWNLOADED"
    InstallStatus.INSTALLING -> "INSTALLING"
    InstallStatus.INSTALLED -> "INSTALLED"
    InstallStatus.FAILED -> "FAILED"
    InstallStatus.CANCELED -> "CANCELED"
    else -> "UNKNOWN"
  }
}
