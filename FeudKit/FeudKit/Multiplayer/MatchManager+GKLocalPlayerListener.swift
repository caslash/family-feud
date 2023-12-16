//
//  MatchManager+GKLocalPlayerListener.swift
//  FeudKit
//
//  Created by Cameron Slash on 12/16/23.
//

import Foundation
import GameKit
import SwiftUI

extension MatchManager: GKLocalPlayerListener {
    public func player(_ player: GKPlayer, didRequestMatchWithRecipients recipientPlayers: [GKPlayer]) {
        print("\n\nSending invites to other players.")
    }
    
    public func player(_ player: GKPlayer, didAccept invite: GKInvite) {
        if let viewController = GKMatchmakerViewController(invite: invite) {
            viewController.matchmakerDelegate = self
            #if os(iOS)
            self.rootViewController?.present(viewController, animated: true)
            #else
            self.rootViewController?.presentAsModalWindow(viewController)
            #endif
        }
    }
}
