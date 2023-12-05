//
//  FamilyFeud_DesktopApp.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 11/30/23.
//

import FeudKit
import SwiftUI

@main
struct FamilyFeud_DesktopApp: App {
    @State private var game = FamilyFeudGame()
    var body: some Scene {
        WindowGroup(id: "Management") {
            ManagementWindow()
                .environment(game)
        }
        .windowResizability(.contentSize)
        
        WindowGroup(id: "Game") {
            GameWindow()
                .environment(game)
        }
    }
}
