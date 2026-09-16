// Notify / dock helpers. Kept out of the Go //export preamble because cgo
// copies that preamble into two C files and duplicate symbols fail the
// Wails macOS link (see cmd/cgo: definitions vs declarations).
#import <Cocoa/Cocoa.h>
#import <UserNotifications/UserNotifications.h>
#include <stdlib.h>
#include <string.h>

extern void qtermNotifyActivated(char *sessionID);
extern void qtermAppActiveChanged(void);

@interface QtermNotifyDelegate : NSObject <UNUserNotificationCenterDelegate>
@end

static NSString *const QtermNotifyCategory = @"qterm.session";
static QtermNotifyDelegate *qtermNotifyDelegate = nil;
static id qtermBecameActiveObs = nil;
static id qtermResignActiveObs = nil;
static int qtermBadgeCount = 0;

@implementation QtermNotifyDelegate
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
	UNNotificationPresentationOptions opts = UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList | UNNotificationPresentationOptionBadge;
	if (@available(macOS 11.0, *)) {
		opts |= UNNotificationPresentationOptionBanner;
	}
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
	opts |= UNNotificationPresentationOptionAlert;
#pragma clang diagnostic pop
	completionHandler(opts);
}
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
	NSString *sid = response.notification.request.content.userInfo[@"sessionId"];
	char *copy = NULL;
	if (sid.length > 0) {
		const char *utf8 = sid.UTF8String;
		if (utf8 != NULL) {
			copy = strdup(utf8);
		}
	}
	qtermNotifyActivated(copy);
	free(copy);
	completionHandler();
}
@end

static void qtermApplyDockBadge(int count) {
	NSDockTile *tile = [NSApp dockTile];
	if (count <= 0) {
		tile.badgeLabel = @"";
	} else {
		tile.badgeLabel = [NSString stringWithFormat:@"%d", count];
	}
	[tile display];
	UNUserNotificationCenter *c = [UNUserNotificationCenter currentNotificationCenter];
	if (@available(macOS 13.3, *)) {
		[c setBadgeCount:(NSInteger)(count > 0 ? count : 0) withCompletionHandler:nil];
	}
}

void QtermNotifyInit(void) {
	static dispatch_once_t once;
	dispatch_once(&once, ^{
		qtermNotifyDelegate = [QtermNotifyDelegate new];
		UNUserNotificationCenter *c = [UNUserNotificationCenter currentNotificationCenter];
		c.delegate = qtermNotifyDelegate;
		UNNotificationAction *open = [UNNotificationAction actionWithIdentifier:@"qterm.open"
		                                                                 title:@"Open"
		                                                               options:UNNotificationActionOptionForeground];
		UNNotificationCategory *cat = [UNNotificationCategory categoryWithIdentifier:QtermNotifyCategory
		                                                                     actions:@[ open ]
		                                                           intentIdentifiers:@[]
		                                                                     options:UNNotificationCategoryOptionNone];
		[c setNotificationCategories:[NSSet setWithObject:cat]];
		NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
		qtermBecameActiveObs = [nc addObserverForName:NSApplicationDidBecomeActiveNotification
		                                       object:nil
		                                        queue:[NSOperationQueue mainQueue]
		                                   usingBlock:^(NSNotification *note) {
			                                 (void)note;
			                                 qtermAppActiveChanged();
		                                   }];
		qtermResignActiveObs = [nc addObserverForName:NSApplicationDidResignActiveNotification
		                                       object:nil
		                                        queue:[NSOperationQueue mainQueue]
		                                   usingBlock:^(NSNotification *note) {
			                                 (void)note;
			                                 qtermAppActiveChanged();
		                                   }];
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

void QtermSetDockBadge(int count) {
	if (count < 0) {
		count = 0;
	}
	qtermBadgeCount = count;
	dispatch_async(dispatch_get_main_queue(), ^{
		qtermApplyDockBadge(qtermBadgeCount);
	});
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
	content.categoryIdentifier = QtermNotifyCategory;
	content.badge = @(qtermBadgeCount);
	if (sessionId != NULL && sessionId[0] != 0) {
		NSString *sid = [NSString stringWithUTF8String:sessionId];
		content.userInfo = @{@"sessionId": sid};
		content.threadIdentifier = sid;
	}
	if (@available(macOS 12.0, *)) {
		content.interruptionLevel = UNNotificationInterruptionLevelTimeSensitive;
	}
	UNNotificationRequest *req = [UNNotificationRequest requestWithIdentifier:nid content:content trigger:nil];
	[[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:req withCompletionHandler:^(NSError *error) {
		(void)error;
		dispatch_async(dispatch_get_main_queue(), ^{
			qtermApplyDockBadge(qtermBadgeCount);
		});
	}];
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
