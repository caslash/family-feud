//
//  MultiplayerService+GKLocalPlayerListener.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/10/23.
//

import Foundation
import GameKit
import SwiftUI

extension MultiplayerService: GKLocalPlayerListener {
    func player(_ player: GKPlayer, didRequestMatchWithRecipients recipientPlayers: [GKPlayer]) {
        print("\n\nSending invites to other players.")
    }
    
    func player(_ player: GKPlayer, didAccept invite: GKInvite) {
        if let viewController = GKMatchmakerViewController(invite: invite) {
            viewController.matchmakerDelegate = self
            #if os(iOS)
            rootViewController?.present(viewController, animated: true) { }
            #else
            rootViewController?.presentAsModalWindow(viewController)
            #endif
        }
    }
}
