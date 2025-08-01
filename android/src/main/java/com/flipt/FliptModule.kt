// Generated by uniffi-bindgen-react-native
package com.flipt

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder

@ReactModule(name = FliptModule.NAME)
class FliptModule(reactContext: ReactApplicationContext) :
  NativeFliptSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  // Two native methods implemented in cpp-adapter.cpp, and ultimately
  // react-native-flipt.cpp

  external fun nativeInstallRustCrate(runtimePointer: Long, callInvoker: CallInvokerHolder): Boolean
  external fun nativeCleanupRustCrate(runtimePointer: Long): Boolean

  override fun installRustCrate(): Boolean {
    val context = this.reactApplicationContext
    return nativeInstallRustCrate(
      context.javaScriptContextHolder!!.get(),
      context.jsCallInvokerHolder!!
    )
  }

  override fun cleanupRustCrate(): Boolean {
    return nativeCleanupRustCrate(
      this.reactApplicationContext.javaScriptContextHolder!!.get()
    )
  }

  companion object {
    const val NAME = "Flipt"

    init {
      System.loadLibrary("react-native-flipt")
    }
  }
}