// Generated by uniffi-bindgen-react-native
#include "react-native-flipt.h"
#include "generated/flipt_react_native.hpp"

namespace flipt {
	using namespace facebook;

	uint8_t installRustCrate(jsi::Runtime &runtime, std::shared_ptr<react::CallInvoker> callInvoker) {
		NativeFliptReactNative::registerModule(runtime, callInvoker);
		return true;
	}

	uint8_t cleanupRustCrate(jsi::Runtime &runtime) {
		return false;
	}
}