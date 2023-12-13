//
//  MultiplayerService+GKMatchmakerViewControllerDelegate.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 12/10/23.
//


import Foundation
import GameKit
import SwiftUI

extension MultiplayerService: GKMatchmakerViewControllerDelegate {
    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFind match: GKMatch) {
        #if os(iOS)
        viewController.dismiss(animated: true)
        #else
        viewController.dismiss(true)
        #endif

        if !playingGame && match.expectedPlayerCount == 0 {
            startMatchWith(match: match)
        }
    }
    
    public func matchmakerViewControllerWasCancelled(_ viewController: GKMatchmakerViewController) {
        #if os(iOS)
        viewController.dismiss(animated: true)
        #else
        viewController.dismiss(true)
        #endif
    }
    
    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFailWithError error: Error) {
        print("\n\nMatchmaker view controller fails with error: \(error.localizedDescription)")
    }
}
