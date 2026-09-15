// Notify / dock helpers. Kept out of the Go //export preamble because cgo
// copies that preamble into two C files and duplicate symbols fail the
// Wails macOS link (see cmd/cgo: definitions vs declarations).
#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>
#include <stdlib.h>

extern void qtermNotifyActivated(char *sessionID);

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
