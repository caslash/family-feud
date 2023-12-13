//
//  FamilyFeudClientApp.swift
//  FamilyFeudClient
//
//  Created by Cameron Slash on 12/10/23.
//

import FeudKit
import SwiftUI

@main
struct FamilyFeudClientApp: App {
    @State private var match: MultiplayerService
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(match)
        }
    }
    
    init() {
        self.match = MultiplayerService()
    }
}
