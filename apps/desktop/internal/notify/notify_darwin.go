//go:build darwin

package notify

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework UserNotifications
#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>
#include <stdlib.h>

extern void qtermNotifyActivated(char* sessionID);

@interface QtermNotifyDelegate : NSObject <UNUserNotificationCenterDelegate>
@end

@implementation QtermNotifyDelegate
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
	completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList);
}
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
	NSString *sid = response.notification.request.content.userInfo[@"sessionId"];
	if (sid.length > 0) {
		qtermNotifyActivated((char *)[sid UTF8String]);
	} else {
		qtermNotifyActivated(NULL);
	}
	completionHandler();
}
@end

static QtermNotifyDelegate *qtermNotifyDelegate = nil;

void QtermNotifyInit(void) {
	static dispatch_once_t once;
	dispatch_once(&once, ^{
		qtermNotifyDelegate = [QtermNotifyDelegate new];
		UNUserNotificationCenter *c = [UNUserNotificationCenter currentNotificationCenter];
		c.delegate = qtermNotifyDelegate;
	});
}

void QtermNotifyRequestAuth(void) {
	QtermNotifyInit();
	UNUserNotificationCenter *c = [UNUserNotificationCenter currentNotificationCenter];
	[c requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
	                completionHandler:^(BOOL granted, NSError *error) {
		(void)granted;
		(void)error;
	}];
}

void QtermNotifyPost(const char *ident, const char *title, const char *body, const char *sessionId) {
	QtermNotifyInit();
	if (ident == NULL || title == NULL) {
		return;
	}
	NSString *nid = [NSString stringWithUTF8String:ident];
	UNMutableNotificationContent *content = [UNMutableNotificationContent new];
	content.title = [NSString stringWithUTF8String:title];
	if (body != NULL) {
		content.body = [NSString stringWithUTF8String:body];
	}
	content.sound = [UNNotificationSound defaultSound];
	if (sessionId != NULL && sessionId[0] != 0) {
		content.userInfo = @{@"sessionId": [NSString stringWithUTF8String:sessionId]};
	}
	UNNotificationRequest *req = [UNNotificationRequest requestWithIdentifier:nid content:content trigger:nil];
	[[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:req withCompletionHandler:nil];
}

void QtermSetDockBadge(int count) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSDockTile *tile = [NSApp dockTile];
		if (count <= 0) {
			tile.badgeLabel = @"";
		} else {
			tile.badgeLabel = [NSString stringWithFormat:@"%d", count];
		}
		[tile display];
	});
}

int QtermAppIsActive(void) {
	__block int active = 0;
	if ([NSThread isMainThread]) {
		return [NSApp isActive] ? 1 : 0;
	}
	dispatch_sync(dispatch_get_main_queue(), ^{
		active = [NSApp isActive] ? 1 : 0;
	});
	return active;
}

void QtermBringToFront(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		[NSApp activateIgnoringOtherApps:YES];
		for (NSWindow *w in [NSApp windows]) {
			if (w.isMiniaturized) {
				[w deminiaturize:nil];
			}
			[w makeKeyAndOrderFront:nil];
		}
	});
}
*/
import "C"
import (
	"sync"
	"unsafe"
)

var (
	activateMu sync.Mutex
	onActivate ActivateHandler
)

//export qtermNotifyActivated
func qtermNotifyActivated(sessionID *C.char) {
	sid := ""
	if sessionID != nil {
		sid = C.GoString(sessionID)
	}
	activateMu.Lock()
	h := onActivate
	activateMu.Unlock()
	if h != nil {
		h(sid)
	}
}

type darwinPoster struct{}

func newPoster() Poster {
	C.QtermNotifyInit()
	return darwinPoster{}
}

func (darwinPoster) RequestAuth() {
	C.QtermNotifyRequestAuth()
}

func (darwinPoster) Post(n Note) {
	ident := n.ID
	if ident == "" {
		ident = n.SessionID
	}
	if ident == "" {
		ident = "qterm"
	}
	cIdent := C.CString(ident)
	cTitle := C.CString(n.Title)
	cBody := C.CString(n.Body)
	cSID := C.CString(n.SessionID)
	defer C.free(unsafe.Pointer(cIdent))
	defer C.free(unsafe.Pointer(cTitle))
	defer C.free(unsafe.Pointer(cBody))
	defer C.free(unsafe.Pointer(cSID))
	C.QtermNotifyPost(cIdent, cTitle, cBody, cSID)
}

func (darwinPoster) SetBadge(count int) {
	C.QtermSetDockBadge(C.int(count))
}

func (darwinPoster) SetOnActivate(h ActivateHandler) {
	activateMu.Lock()
	onActivate = h
	activateMu.Unlock()
}

func (darwinPoster) AppActive() bool {
	return C.QtermAppIsActive() != 0
}

func (darwinPoster) BringToFront() {
	C.QtermBringToFront()
}
